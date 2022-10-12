import { pipe } from '../lib/functions';
import {
  asIterable,
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
  toRecord
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
export type SearchHighlights = Record<string, string[]>;
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

function toPaths(ast: Parsers.SelectAst) {
  return Array.isArray(ast)
    ? ast.map(f => Array.isArray(f.value) ? f.value.join('/') : f.value)
    : [];
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

const defaultSearchScoreMapper = () => ({ match: true, score: 0, highlights: {}, features: {}});
function createSearchScoreMapper(
  searchables: FlatSchema,
  highlights: Parsers.SelectAst,
  highlightPostTag: string,
  highlightPreTag: string,
  searchText: string,
) {
  const highlightsPaths = toPaths(highlights);

  const searchRegex = new RegExp(searchText, 'g');

  function matchAll(value: string | string[]) {
    if (Array.isArray(value)) {
      return value
        .map(str => Array.from(str.matchAll(searchRegex)))
        .reduce((a, c) => [...a, ...c], []);
    }

    return Array.from(value.matchAll(searchRegex));
  }

  function matchAllByField(field: FieldDefinition, value: unknown): RegExpMatchArray[] {
    switch (field.type) {
      case 'Edm.String':
        return matchAll(value as string);
      case 'Collection(Edm.String)':
        return matchAll(value as string[]);
      default:
        return [];
    }
  }

  return (document: Record<string, unknown>) => {
    const { score, highlights, features } = searchables.reduce(
      (acc, [path, last]) => {
        const value = getValue(document, path.split('/'));

        if (value == null) {
          return acc;
        }

        const matches = matchAllByField(last, value);
        const tokens  = pipe(
          matches,
          flatten,
          toArray,
        ) as string[];

        if (tokens.length) {
          acc.score += sum(tokens.map(t => t.length));

          const uniqueTokens = Array.from(new Set(tokens));
          const valueLength = Array.isArray(value)
            ? sum((value as string[]).map(v => v.length))
            : (value as string).length;

          const matchedLength = sum(uniqueTokens.map(h => h.length));

          if (highlightsPaths.includes(path)) {
            acc.highlights[last.name] = uniqueTokens.map(t => `${highlightPreTag}${t}${highlightPostTag}`);
          }

          acc.features[last.name] = {
            uniqueTokenMatches: uniqueTokens.length,
            similarityScore: matchedLength / valueLength,
            termFrequency: tokens.length,
          }
        }

        return acc;
      },
      { score: 0, highlights: {} as SearchHighlights, features: {} as SearchFeatures }
    );

    return { match: score !== 0, score, highlights, features };
  }
}

const defaultPageSize = 50;
const maxPageSize = 1000;

export class SearchEngine<T extends object> {
  constructor(
    private readonly flatSchemaProvider: () => FlatSchema,
    private readonly documentsProvider: () => T[],
  ) {
  }

  public search<Keys extends ODataSelect<T>>(request: SearchDocumentsRequest<T, Keys>): SearchDocumentsPageResult<ODataSelectResult<T, Keys>> {
    const filterAst = request.filter && Parsers.filter.parse(request.filter) || undefined;
    const orderByAst = request.orderBy && Parsers.orderBy.parse(request.orderBy.join(', ')) || undefined;
    const selectAst = request.select && Parsers.select.parse(request.select.join(', ')) || undefined;
    const searchFieldsAst = request.searchFields && Parsers.search.parse(request.searchFields) || undefined;
    const highlightAst = request.highlight && Parsers.highlight.parse(request.highlight) || undefined;
    const facetAst = request.facets && request.facets.map(f => Parsers.facet.parse(f)) || undefined;

    const requirementFailures: string[] = [
      ...(filterAst?.canApply(this.flatSchemaProvider()) ?? []),
      ...(orderByAst?.canApply(this.flatSchemaProvider()) ?? []),
      ...(selectAst?.canApply(this.flatSchemaProvider()) ?? []),
      ...(searchFieldsAst?.canApply(this.flatSchemaProvider()) ?? []),
      ...(highlightAst?.canApply(this.flatSchemaProvider()) ?? []),
      ...(pipe(facetAst ?? [], map(f => f.canApply(this.flatSchemaProvider())), flatten)),
    ];

    if (requirementFailures.length) {
      throw new SchemaError('Part of the request is not compatible with the current schema', requirementFailures);
    }

    const searchScoreMapper = request.search
      ? createSearchScoreMapper(
        // TODO: Reverse the algorithm to scan pre-applied documents instead of the schema
        this.flatSchemaProvider().filter(isFieldSearchable(searchFieldsAst ?? [])),
        highlightAst ?? [],
        request.highlightPostTag ?? '',
        request.highlightPreTag ?? '',
        request.search,
      )
      : defaultSearchScoreMapper;

    const searchResults = pipe(
      asIterable(this.documentsProvider()),
      map(document => ({ document, filterScore: filterAst?.apply(document) ?? 1 })),
      filter(({filterScore}) => filterScore >= 0),
      map(({document, filterScore}) => ({ document, filterScore, ...searchScoreMapper(document as Record<string, unknown>) })),
      filter(({match}) => match),
      map(({document, filterScore, score, highlights, features}) => ({
        document,
        metas: {
            '@search.score': filterScore + score,
            '@search.highlights': highlights,
            '@search.features': features,
          }
      })),
      reduce<
        { document: T, metas: SearchDocumentMeta },
        { facets: Parsers.FacetResults, results: [T, SearchDocumentMeta][] }
      >(
        (acc, {document, metas}) => {
          if (facetAst) {
            acc.facets = facetAst.reduce((a, c) => c.apply(a, document), acc.facets);
          }
          acc.results.push([document, metas]);
          return acc;
        },
        { facets: {}, results: [] },
        acc => {
          if (orderByAst) {
            acc.results.sort(orderByAst.apply);
          }
          return acc;
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

    const selected: SearchResult<ODataSelectResult<T, Keys>>[] = selectAst
      ? searchResults.results.map(([r, meta]) => ({
        ...selectAst.apply(r) as ODataSelectResult<T, Keys>,
        ...meta,
      } as SearchResult<ODataSelectResult<T, Keys>>))
      : searchResults.results.map(([r, meta]) => ({
        ...r as unknown as ODataSelectResult<T, Keys>,
        ...meta,
      }));
    const skip = request.skip ?? 0;
    const top = request.top ?? defaultPageSize;
    const pageSize = Math.min(top, maxPageSize);
    const limited = selected.slice(skip, skip + pageSize);

    const nextPageRequest = top > maxPageSize && selected.length > skip + pageSize
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
