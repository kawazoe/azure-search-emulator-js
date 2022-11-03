import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import type { KeyFieldDefinition } from './schema';
import type { SuggestResult } from './searchBackend';
import {
  SearchBackend,
  useCoverage,
  useSelect,
  useFilterScoring,
  useLimiterMiddleware,
  useOrderBy,
  useSearchScoring,
  createHighlightSuggestionStrategy,
  useSuggestResult,
  useStripScore
} from './searchBackend';

export interface SuggestRequest<T extends object, Keys extends ODataSelect<T> | string> {
  filter?: string;          //< OData Filter expression
  fuzzy?: boolean;          //< Not supported
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  orderBy?: string;         //< OrderBy Expression
  search: string;           //< simple query expression
  searchFields?: string;    //< fields as ODataSelect
  select?: Keys[];          //< fields as ODataSelect
  suggesterName: string;
  top?: number;
}

export interface SuggestDocumentsResult<T extends object> {
  '@search.coverage'?: number;
  value: SuggestResult<T>[];
}

export interface Suggester {
  name: string;
  searchMode: 'analyzingInfixMatching';
  fields: string[];
}

const defaultPageSize = 5;
const maxPageSize = 100;

export class SuggestEngine<T extends object> {
  constructor(
    private backend: SearchBackend<T>,
    private keyFieldProvider: () => KeyFieldDefinition,
    private suggesterProvider: (name: string) => Suggester,
  ) {
  }

  public suggest<Keys extends ODataSelect<T>>(request: SuggestRequest<T, Keys>): SuggestDocumentsResult<ODataSelectResult<T, Keys>> {
    const documentMiddlewares = [
      ...(request.filter ? [useFilterScoring<T, Keys>(request.filter)] : []),
      ...(request.search ? [useSearchScoring<T, Keys>({
        search: request.search,
        searchFields: request.searchFields ?? '*',
        suggestionStrategy: createHighlightSuggestionStrategy<T>({
          highlight: request.searchFields ?? this.suggesterProvider(request.suggesterName).fields.join(', '),
          preTag: request.highlightPreTag ?? '',
          postTag: request.highlightPostTag ?? '',
          maxPadding: 30,
        }),
        scoringStrategies: {},
      })] : []),
      useSelect<T, Keys>(request.select ?? [this.keyFieldProvider().name as Keys]),
      useSuggestResult<T, Keys>(),
    ];

    const resultsMiddlewares = [
      useOrderBy<T, Keys>(request.orderBy ?? 'search.score() desc'),
      ...(request.minimumCoverage ? [useCoverage<T, Keys>()] : []),
      useLimiterMiddleware<T, Keys>(request.top && Math.min(request.top, maxPageSize) || defaultPageSize),
      useStripScore<T, Keys>(),
    ];

    return this.backend.search({ documentMiddlewares, resultsMiddlewares }) as SuggestDocumentsResult<ODataSelectResult<T, Keys>>;
  }
}