import type { Suggester } from './suggestEngine';
import type { AutocompleteResult } from './searchBackend';
import { SearchBackend } from './searchBackend';
import { Scorer } from './scorer';

import { useFiltering } from './middlewares/reducer/filtering';
import { createAutocompleteSuggestionStrategy, useLuceneSearch } from './middlewares/reducer/luceneSearch';
import { useScoringProfiles } from './middlewares/reducer/scoringProfiles';
import { useAutocompleteResult } from './middlewares/reducer/autocompleteResult';
import { useOrderBy } from './middlewares/transformer/orderBy';
import { useCoverage } from './middlewares/transformer/coverage';
import { useLimiterMiddleware } from './middlewares/transformer/limiter';
import { useStripScore } from './middlewares/transformer/stripScore';
import { PlainAnalysisMode, createPlainQueryStrategy } from './analyzerService';

export interface AutoCompleteRequest {
  autocompleteMode?: PlainAnalysisMode;
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
      ...(request.filter ? [useFiltering<T, '*'>(request.filter)] : []),
      ...(request.search ? [useLuceneSearch<T, '*'>({
        searchFields: request.searchFields ?? '*',
        queryingStrategy: createPlainQueryStrategy({
          search: request.search,
          analysisMode: request.autocompleteMode ?? 'oneTerm'
        }),
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
