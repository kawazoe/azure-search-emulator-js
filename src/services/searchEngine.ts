import { pipe } from '../lib/functions';
import { identity, map, sort, take, toArray, toIterable, toRecord, } from '../lib/iterables';
import type { ODataSelect, ODataSelectResult } from '../lib/odata';
import { toODataQuery } from '../lib/odata';

import * as Parsers from '../parsers';

import type { SearchFacetBase, SearchFacetValue, SearchResult } from './searchBackend';
import { SearchBackend } from './searchBackend';

export interface SearchDocumentsRequest<T extends object, Keys extends ODataSelect<T> | string> {
  count?: boolean;
  facets?: string[];          //< Facet expressions
  filter?: string;            //< OData Filter expression
  highlight?: string;         //< fields as csv
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  orderBy?: string;           //< OrderBy Expression
  queryType?: 'simple' | 'full';  //< Not supported
  search?: string;            //< simple query expression
  searchFields?: string;      //< fields as ODataSelect
  searchMode?: 'any' | 'all'; //< Not supported
  select?: Keys[];            //< fields as ODataSelect
  skip?: number;
  top?: number;
}

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

export class SearchEngine<T extends object> {
  constructor(
    private readonly backend: SearchBackend<T>,
  ) {
  }

  public search<Keys extends ODataSelect<T>>(request: SearchDocumentsRequest<T, Keys>): SearchDocumentsPageResult<ODataSelectResult<T, Keys>> {
    const filterCommand = request.filter && Parsers.filter.parse(request.filter) || null;
    const orderByCommand = Parsers.orderBy.parse(request.orderBy ?? 'search.score() desc');
    const selectCommand = request.select && Parsers.select.parse(request.select.join(', ')) || null;
    const searchFieldsCommand = request.searchFields && Parsers.search.parse(request.searchFields) || null;
    const highlightCommand = request.highlight && Parsers.highlight.parse(request.highlight) || null;
    const facetCommands = request.facets && request.facets.map(f => Parsers.facet.parse(f)) || null;

    const searchResults = this.backend.search({
      search: request.search ?? null,
      highlightPreTag: request.highlightPreTag ?? '<em>',
      highlightPostTag: request.highlightPostTag ?? '</em>',
      filterCommand,
      orderByCommand,
      selectCommand,
      searchFieldsCommand,
      highlightCommand,
      facetCommands,
    });

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
    const limited = searchResults.values.slice(skip, skip + pageSize);

    const nextPageRequest = top > maxPageSize && searchResults.values.length > skip + pageSize
      ? {
        ...request,
        skip: skip + pageSize,
        top: top - pageSize,
      }
      : undefined;

    const count = request.count ? searchResults.values.length : null;
    const coverage = request.minimumCoverage ? 100 : null;

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
