import { flatten, sum } from '../lib/arrays';
import * as Parsers from '../parsers';
import { FieldDefinition } from './schema';
import { DataStore } from './dataStore';
import { ODataSelect, ODataSelectResult, toODataQuery } from '../lib/odata';
import { pipe } from '../lib/functions';
import { filter, identity, map, reduce, sort, take, toArray, toIterator, toRecord } from '../lib/generators';
import { getValue } from '../lib/objects';

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
    const searchable = searchableTypes.includes(last.type)
      && (last as { searchable?: boolean }).searchable
      || false;

    if (searchable && searchFieldPaths.length) {
      return searchFieldPaths.includes(path);
    }

    return searchable;
  };
}

const defaultSearchScoreMapper = () => ({ match: true, score: 0, highlights: {}, features: {}});
function createSearchScoreMapper(
  searchables: [string, FieldDefinition][],
  highlights: Parsers.SelectAst,
  highlightPostTag: string,
  highlightPreTag: string,
  searchText: string
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
        const matches = matchAllByField(last, value);
        const tokens = flatten(matches);

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
            termFrequency: tokens.length
          }
        }

        return acc;
      },
      { score: 0, highlights: {} as SearchHighlights, features: {} as SearchFeatures }
    );

    return { match: score !== 0, score, highlights, features };
  }
}

const maxPageSize = 50;

export class SearchEngine<T extends object> {
  constructor(
    private readonly dataStore: DataStore<T>,
  ) {
  }

  public search<Keys extends ODataSelect<T>>(request: SearchDocumentsRequest<T, Keys>): SearchDocumentsPageResult<ODataSelectResult<T, Keys>> {
    const filterAst = request.filter && Parsers.filter.parse(request.filter) || undefined;
    const orderByAst = request.orderBy && Parsers.orderBy.parse(request.orderBy.join(', ')) || undefined;
    const selectAst = request.select && Parsers.select.parse(request.select.join(', ')) || undefined;
    const searchFieldsAst = request.searchFields && Parsers.select.parse(request.searchFields) || undefined;
    const highlightAst = request.highlight && Parsers.highlight.parse(request.highlight) || undefined;
    const facetAst = request.facets && request.facets.map(f => Parsers.facet.parse(f)) || undefined;

    const searchScoreMapper = request.search
      ? createSearchScoreMapper(
        this.dataStore.flatSchema.filter(isFieldSearchable(searchFieldsAst ?? [])),
        highlightAst ?? [],
        request.highlightPostTag ?? '',
        request.highlightPreTag ?? '',
        request.search
      )
      : defaultSearchScoreMapper;

    const searchResults = pipe(
      toIterator(this.dataStore.documents),
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

    const facets = pipe(
      toIterator(searchResults.facets),
      map(([key, facet]): [string, SearchFacetBase[]] => [
        key,
        pipe(
          toIterator(facet.results),
          facet.params.sort ? sort(facet.params.sort) : identity,
          take(facet.params.count),
          // TODO: Add support for ranged facets
          map(([value, count]) => ({value, count} as SearchFacetValue)),
          toArray
        ),
      ]),
      toRecord,
    )

    const selected: SearchResult<ODataSelectResult<T, Keys>>[] = selectAst
      ? searchResults.results.map(([r, meta]) => ({
        ...selectAst.apply<T, Keys>(r),
        ...meta,
      } as SearchResult<ODataSelectResult<T, Keys>>))
      : searchResults.results.map(([r, meta]) => ({
        ...r,
        ...meta,
      } as SearchResult<ODataSelectResult<T, Keys>>));
    const skip = request.skip ?? 0;
    const top = Math.min(request.top ?? maxPageSize, maxPageSize);
    const limited = selected.slice(skip, skip + top);
    const hasMore = top > limited.length;

    const nextPageRequest = hasMore
      ? {
        ...request,
        ...(request.skip ? { skip: request.skip + limited.length } : {}),
        ...(request.top ? { top: request.top - limited.length } : {})
      }
      : undefined;

    return {
      '@odata.count': request.count ? searchResults.results.length : undefined,
      '@search.coverage': request.minimumCoverage ? 100 : undefined,
      '@search.facets': request.facets ? facets : undefined,
      '@search.nextPageParameters': nextPageRequest,
      value: limited,
      '@odata.nextLink': nextPageRequest ? toODataQuery(nextPageRequest) : undefined,
    }
  }
}
