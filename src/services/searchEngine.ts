import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import type { SearchFacetBase, SearchResult } from './searchBackend';
import {
  SearchBackend,
  useCount,
  useCoverage,
  useSearchResult,
  useSelect,
  useFacetExtraction,
  useFacetTransformation,
  useFilterScoring,
  useOrderBy,
  usePagingMiddleware,
  useSearchScoring,
  createHighlightSuggestionStrategy, useScoringProfiles
} from './searchBackend';
import { Scorer } from './scorer';

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
  scoringParameters?: string[],
  scoringProfile?: string,
  scoringStatistics?: 'local' | 'global',  //< Not supported
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
    private readonly scorer: Scorer<T>,
  ) {
  }

  public search<Keys extends ODataSelect<T>>(request: SearchDocumentsRequest<T, Keys>): SearchDocumentsPageResult<ODataSelectResult<T, Keys>> {
    const documentMiddlewares = [
      ...(request.filter ? [useFilterScoring<T, Keys>(request.filter)] : []),
      ...(request.search ? [useSearchScoring<T, Keys>({
        search: request.search,
        searchFields: request.searchFields ?? '*',
        suggestionStrategy: createHighlightSuggestionStrategy<T>({
          highlight: request.highlight ?? '',
          preTag: request.highlightPreTag ?? '<em>',
          postTag: request.highlightPostTag ?? '</em>',
          maxPadding: 30,
        }),
      })] : []),
      ...(request.facets ? [useFacetExtraction<T, Keys>(request.facets)] : []),
      ...(request.select ? [useSelect<T, Keys>(request.select)] : []),
      useScoringProfiles<T, Keys>({
        scoringStrategies: this.scorer.getScoringStrategies(
          request.scoringProfile ?? null,
          request.scoringParameters ?? null
        ),
      }),
      useSearchResult<T, Keys>(),
    ];

    const resultsMiddlewares = [
      useOrderBy<T, Keys>(request.orderBy ?? 'search.score() desc'),
      ...(request.count ? [useCount<T, Keys>()] : []),
      ...(request.minimumCoverage ? [useCoverage<T, Keys>()] : []),
      ...(request.facets ? [useFacetTransformation<T, Keys>()] : []),
      usePagingMiddleware<T, Keys>({ skip: request.skip ?? 0, top: request.top ?? defaultPageSize, maxPageSize, request })
    ];

    return this.backend.search({ documentMiddlewares, resultsMiddlewares }) as SearchDocumentsPageResult<ODataSelectResult<T, Keys>>;
  }
}
