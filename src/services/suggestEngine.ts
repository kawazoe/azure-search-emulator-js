import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import type { KeyFieldDefinition } from './schema';
import type { SuggestResult } from './searchBackend';
import { SearchBackend } from './searchBackend';
import { Scorer } from './scorer';

import { useFiltering } from './middlewares/reducer/filtering';
import { createReplacementSuggestionStrategy, useLuceneSearch } from './middlewares/reducer/luceneSearch';
import { useSelect } from './middlewares/reducer/select';
import { useScoringProfiles } from './middlewares/reducer/scoringProfiles';
import { useSuggestResult } from './middlewares/reducer/suggestResult';
import { useOrderBy } from './middlewares/transformer/orderBy';
import { useCoverage } from './middlewares/transformer/coverage';
import { useLimiterMiddleware } from './middlewares/transformer/limiter';
import { useStripScore } from './middlewares/transformer/stripScore';
import { createPlainQueryStrategy } from './analyzerService';

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
      ...(request.filter ? [useFiltering<T, Keys>(request.filter)] : []),
      useLuceneSearch<T, Keys>({
        searchFields: request.searchFields ?? '*',
        queryingStrategy: createPlainQueryStrategy({
          search: request.search,
          analysisMode: 'oneTermWithContext',
        }),
        suggestionStrategy: createReplacementSuggestionStrategy<T>({
          highlight: request.searchFields ?? this.suggesterProvider(request.suggesterName).fields.join(', '),
          preTag: request.highlightPreTag ?? '',
          postTag: request.highlightPostTag ?? '',
        }),
      }),
      useSelect<T, Keys>(request.select ?? [this.keyFieldProvider().name as Keys]),
      useScoringProfiles<T, Keys>({ scoringStrategies: Scorer.nullStrategy }),
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
