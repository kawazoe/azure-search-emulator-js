import type { Suggester } from './suggestEngine';
import type { AutocompleteModes, AutocompleteResult } from './searchBackend';
import {
  SearchBackend,
  useCoverage,
  useFilterScoring,
  useLimiterMiddleware,
  useOrderBy,
  useSearchScoring,
  useAutocompleteResult,
  createAutocompleteSuggestionStrategy,
  useStripScore, useScoringProfiles
} from './searchBackend';
import { Scorer } from './scorer';

export interface AutoCompleteRequest {
  autocompleteMode?: AutocompleteModes;
  filter?: string;          //< OData Filter expression
  fuzzy?: boolean;
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  search: string;           //< simple query expression
  searchFields?: string;    //< fields as ODataSelect
  suggesterName: string;
  top?: number;
}

export interface AutoCompleteDocumentResult {
  '@search.coverage'?: number;
  value: AutocompleteResult[];
}

const defaultPageSize = 5;
const maxPageSize = 100;

export class AutocompleteEngine<T extends object> {
  constructor(
    private readonly backend: SearchBackend<T>,
    private readonly suggesterProvider: (name: string) => Suggester,
  ) {
  }

  public autocomplete(request: AutoCompleteRequest): AutoCompleteDocumentResult {
    const documentMiddlewares = [
      ...(request.filter ? [useFilterScoring<T, '*'>(request.filter)] : []),
      ...(request.search ? [useSearchScoring<T, '*'>({
        search: request.search,
        searchFields: request.searchFields ?? '*',
        suggestionStrategy: createAutocompleteSuggestionStrategy<T>({
          highlight: request.searchFields ?? this.suggesterProvider(request.suggesterName).fields.join(', '),
          preTag: request.highlightPreTag ?? '',
          postTag: request.highlightPostTag ?? '',
          mode: request.autocompleteMode ?? 'oneTerm',
        }),
      })] : []),
      useScoringProfiles<T, '*'>({ scoringStrategies: Scorer.nullStrategy }),
      useAutocompleteResult<T, '*'>(),
    ];

    const resultsMiddlewares = [
      useOrderBy<T, '*'>('search.score() desc'),
      ...(request.minimumCoverage ? [useCoverage<T, '*'>()] : []),
      useLimiterMiddleware<T, '*'>(request.top && Math.min(request.top, maxPageSize) || defaultPageSize),
      useStripScore<T, '*'>(),
    ];

    return this.backend.search({ documentMiddlewares, resultsMiddlewares }) as AutoCompleteDocumentResult;
  }
}