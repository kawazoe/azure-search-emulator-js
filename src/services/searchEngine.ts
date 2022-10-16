import { pipe } from '../lib/functions';
import {
  filter,
  flatten,
  identity,
  map,
  reduce,
  sort,
  sum,
  take,
  toArray,
  toIterable,
  toRecord,
  uniq
} from '../lib/iterables';
import { getValue } from '../lib/objects';
import type { ODataSelect, ODataSelectResult } from '../lib/odata';
import { toODataQuery } from '../lib/odata';

import * as Parsers from '../parsers';
import type { FieldDefinition, FlatSchema } from './schema';
import { SchemaError } from './schema';

export interface SearchDocumentsRequest<T extends object, Keys extends ODataSelect<T> | string> {
  count?: boolean;
  facets?: string[];          //< Facet expressions
  filter?: string;            //< OData Filter expression
  highlight?: string;         //< fields as csv
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  orderBy?: string[];         //< OrderBy Expression
  queryType?: 'simple' | 'full';
  search?: string;            //< simple query expression
  searchFields?: string;      //< fields as ODataSelect
  searchMode?: 'any' | 'all';
  select?: Keys[];            //< fields as ODataSelect
  skip?: number;
  top?: number;
}

export interface SearchFacetBase {
  count: number;
}
export interface SearchFacetValue extends SearchFacetBase {
  value: unknown;
}
export interface SearchFacetRange extends SearchFacetBase {
  from: unknown;
  to: unknown;
}
export type SearchHighlights = Record<string, FieldDefinition['type'] | string[]>;
export interface SearchFeature {
  uniqueTokenMatches: number;
  similarityScore: number;
  termFrequency: number;
}
export type SearchFeatures = Record<string, SearchFeature>;
export interface SearchDocumentMeta {
  '@search.score'?: number;
  '@search.highlights': SearchHighlights;
  '@search.features': SearchFeatures;
}
export type SearchResult<T extends object> = SearchDocumentMeta & T;
export interface SearchDocumentsPageResult<T extends object> {
  '@odata.count'?: number;
  '@search.coverage'?: number;
  '@search.facets'?: Record<string, SearchFacetBase[]>;
  '@search.nextPageParameters'?: SearchDocumentsRequest<T, string>;
  value: SearchResult<T>[];
  '@odata.nextLink'?: string;
}

const defaultPageSize = 50;
const maxPageSize = 1000;

const maxHighlightPadding = 30;

function toPaths(ast: Parsers.SelectAst) {
  return ast.type === 'WILDCARD'
    ? []
    : ast.value.map(f =>
      Array.isArray(f.value)
        ? f.value.join('/')
        : f.value
    );
}

function isFieldSearchable(searchFields: Parsers.SelectAst): (field: [string, FieldDefinition]) => boolean {
  const searchFieldPaths = toPaths(searchFields);

  const searchableTypes = ['Edm.String', 'Collection(Edm.String)'];
  return ([path, last]) => {
    const isFieldSearchable = (last as { searchable?: boolean }).searchable ?? true;
    const searchable = isFieldSearchable && searchableTypes.includes(last.type);

    if (searchable && searchFieldPaths.length) {
      return searchFieldPaths.includes(path);
    }

    return searchable;
  };
}

function defaultFilterScoreMapper() {
  return { filterMatch: true, filterScore: 0 };
}

function createFilterScoreMapper<T>(filterCommand: Parsers.FilterParserResult) {
  return (document: T) => {
    const filterScore = filterCommand.apply(document);
    return ({ filterMatch: filterScore > 0, filterScore });
  };
}

const defaultSearchScoreMapper = () => ({ searchMatch: true, searchScore: 0, highlights: {}, features: {}});
function createSearchScoreMapper<T>(
  searchables: FlatSchema,
  highlights: Parsers.SelectAst,
  highlightPostTag: string,
  highlightPreTag: string,
  searchText: string,
) {
  const highlightsPaths = toPaths(highlights);
  const searchRegex = new RegExp(searchText, 'g');

  function normalizeValue(field: FieldDefinition, value: unknown): string[] {
    switch (field.type) {
      case 'Edm.String':
        return [value as string];
      case 'Collection(Edm.String)':
        return value as string[];
      default:
        return [];
    }
  }

  return (document: T) => {
    const { searchScore, highlights, features } = searchables.reduce(
      (acc, [path, last]) => {
        const value = getValue(document, path.split('/'));

        if (value == null) {
          return acc;
        }

        const normalized = normalizeValue(last, value);
        const matches = pipe(
          normalized,
          map(str => Array.from(str.matchAll(searchRegex))),
          flatten,
          toArray,  //< Required since RegExpMatchArray doesn't directly iterate with the same result
        );
        const tokens  = pipe(
          matches,
          flatten,
          toArray,
        ) as string[];

        if (tokens.length) {
          acc.searchScore += sum(tokens.map(t => t.length));

          const uniqueTokens = pipe(tokens, uniq(), toArray);
          const valueLength = sum(normalized.map(v => v.length));
          const matchedLength = sum(tokens.map(h => h.length));

          if (highlightsPaths.includes(path)) {
            acc.highlights[`${last.name}@odata.type`] = last.type;
            acc.highlights[last.name] = pipe(
              matches,
              map(m => ({ match: m[0], index: m.index ?? 0, input: m.input ?? '' })),
              uniq(m => m.match),
              map(m => {
                const leftPadding = m.input.slice(Math.max(0, m.index - maxHighlightPadding), m.index);
                const rightPadding = m.input.slice(m.index + m.match.length, m.index + m.match.length + maxHighlightPadding);
                return `${leftPadding}${highlightPreTag}${m.match}${highlightPostTag}${rightPadding}`;
              }),
              toArray,
            );
          }

          acc.features[last.name] = {
            uniqueTokenMatches: uniqueTokens.length,
            similarityScore: valueLength === 0
              ? 0
              : (matchedLength / valueLength),
            termFrequency: tokens.length,
          }
        }

        return acc;
      },
      { searchScore: 0, highlights: {} as SearchHighlights, features: {} as SearchFeatures }
    );

    return { searchMatch: searchScore > 0, searchScore, highlights, features };
  }
}

export class SearchEngine<T extends object> {
  constructor(
    private readonly flatSchemaProvider: () => FlatSchema,
    private readonly documentsProvider: () => T[],
  ) {
  }

  public search<Keys extends ODataSelect<T>>(request: SearchDocumentsRequest<T, Keys>): SearchDocumentsPageResult<ODataSelectResult<T, Keys>> {
    const filterCommand = request.filter && Parsers.filter.parse(request.filter) || undefined;
    const orderByCommand = request.orderBy && Parsers.orderBy.parse(request.orderBy.join(', ')) || undefined;
    const selectCommand = request.select && Parsers.select.parse(request.select.join(', ')) || undefined;
    const searchFieldsCommand = request.searchFields && Parsers.search.parse(request.searchFields) || undefined;
    const highlightCommand = request.highlight && Parsers.highlight.parse(request.highlight) || undefined;
    const facetCommand = request.facets && request.facets.map(f => Parsers.facet.parse(f)) || undefined;

    const requirementFailures: string[] = [
      ...(filterCommand?.canApply(this.flatSchemaProvider()) ?? []),
      ...(orderByCommand?.canApply(this.flatSchemaProvider()) ?? []),
      ...(selectCommand?.canApply(this.flatSchemaProvider()) ?? []),
      ...(searchFieldsCommand?.canApply(this.flatSchemaProvider()) ?? []),
      ...(highlightCommand?.canApply(this.flatSchemaProvider()) ?? []),
      ...(pipe(facetCommand ?? [], map(f => f.canApply(this.flatSchemaProvider())), flatten)),
    ];

    if (requirementFailures.length) {
      throw new SchemaError('Part of the request is not compatible with the current schema', requirementFailures);
    }

    const filterScoreMapper = filterCommand
      ? createFilterScoreMapper(filterCommand)
      : defaultFilterScoreMapper;

    const searchScoreMapper = request.search
      ? createSearchScoreMapper(
        // TODO: Reverse the algorithm to scan pre-applied documents instead of the schema
        this.flatSchemaProvider().filter(isFieldSearchable(searchFieldsCommand ?? { type: 'WILDCARD' })),
        highlightCommand ?? { type: 'LIST', value: [] },
        request.highlightPostTag ?? '</em>',
        request.highlightPreTag ?? '<em>',
        request.search,
      )
      : defaultSearchScoreMapper;

    const searchResults = pipe(
      this.documentsProvider(),
      map(document => ({ document, ...filterScoreMapper(document) })),
      filter(({filterMatch}) => filterMatch),
      map(({document, filterScore}) => ({ document, filterScore, ...searchScoreMapper(document) })),
      filter(({searchMatch}) => searchMatch),
      map(({document, filterScore, searchScore, highlights, features}) => ({
        document,
        metas: {
            '@search.score': filterScore + searchScore,
            '@search.highlights': highlights,
            '@search.features': features,
          }
      })),
      reduce(
        (
          acc: { facets: Parsers.FacetResults, results: [T, SearchDocumentMeta][] },
          {document, metas}: {document: T, metas: SearchDocumentMeta}
        ) => {
          if (facetCommand) {
            acc.facets = facetCommand.reduce((a, c) => c.apply(a, document), acc.facets);
          }
          acc.results.push([document, metas]);
          return acc;
        },
        { facets: {}, results: [] },
        acc => {
          const selected: SearchResult<ODataSelectResult<T, Keys>>[] = selectCommand
            ? acc.results.map(([r, meta]) => ({
              ...selectCommand.apply(r) as ODataSelectResult<T, Keys>,
              ...meta,
            } as SearchResult<ODataSelectResult<T, Keys>>))
            : acc.results.map(([r, meta]) => ({
              ...r as unknown as ODataSelectResult<T, Keys>,
              ...meta,
            }));

          if (orderByCommand) {
            selected.sort(orderByCommand.apply);
          }

          return {
            facets: acc.facets,
            results: selected,
          };
        }
      ),
    );

    const facets = request.facets ? pipe(
      toIterable(searchResults.facets),
      map(([key, facet]): [string, SearchFacetBase[]] => [
        key,
        pipe(
          toIterable(facet.results),
          facet.params.sort ? sort(facet.params.sort) : identity,
          take(facet.params.count),
          // TODO: Add support for ranged facets
          map(([value, count]) => ({value, count} as SearchFacetValue)),
          toArray
        ),
      ]),
      toRecord,
    ) : undefined;

    const skip = request.skip ?? 0;
    const top = request.top ?? defaultPageSize;
    const pageSize = Math.min(top, maxPageSize);
    const limited = searchResults.results.slice(skip, skip + pageSize);

    const nextPageRequest = top > maxPageSize && searchResults.results.length > skip + pageSize
      ? {
        ...request,
        skip: skip + pageSize,
        top: top - pageSize,
      }
      : undefined;

    const count = request.count ? searchResults.results.length : undefined;
    const coverage = request.minimumCoverage ? 100 : undefined;

    return {
      ...(count == null ? {} : { '@odata.count': count }),
      ...(coverage == null ? {} : { '@search.coverage': coverage}),
      ...(facets == null ? {} : { '@search.facets': facets }),
      ...(nextPageRequest == null ? {} : { '@search.nextPageParameters': nextPageRequest }),
      value: limited,
      ...(nextPageRequest == null ? {} : { '@odata.nextLink': toODataQuery(nextPageRequest) }),
    }
  }
}
