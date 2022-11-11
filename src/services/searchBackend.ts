import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import type { FieldDefinition } from './schema';
import { SchemaService } from './schema';
import type { ScoringBases } from './scorer';
import type { StoredDocument } from './dataStore';

import * as Parsers from '../parsers';

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
export type SearchSuggestions = Record<string, unknown[]>;
export interface SearchDocumentMeta {
  '@search.score'?: number;
  '@search.highlights': SearchHighlights;
  '@search.features': SearchFeatures;
}

export type SearchResult<T extends object> = SearchDocumentMeta & T;
export interface SuggestDocumentMeta {
  '@search.text': string;
}
export interface AutocompleteResult {
  text: string;
  queryPlusText: string;
}
export type SuggestResult<T extends object> = SuggestDocumentMeta & T;
export interface BackendResults<T extends object> {
  '@odata.count'?: number;
  '@search.coverage'?: number;
  '@search.facets'?: Record<string, SearchFacetBase[]>;
  '@search.nextPageParameters'?: Record<string, unknown>;
  value: (SearchResult<T> | SuggestResult<T> | AutocompleteResult)[];
  '@odata.nextLink'?: string;
}

export interface ReductionResults<T extends object> {
  facets: Parsers.FacetResults;
  values: (SearchResult<T> | SuggestResult<T> | AutocompleteResult)[];
}
export type Reducer<T extends object, Keys extends ODataSelect<T>> = (
  accumulator: ReductionResults<ODataSelectResult<T, Keys>>,
  current: {
    document: StoredDocument<T>,
    selected?: ODataSelectResult<T, Keys>,
    globalScore: number,
    scores: ScoringBases,
    suggestions: SearchSuggestions,
    features: SearchFeatures,
  }
) => ReductionResults<ODataSelectResult<T, Keys>>;
export type DocumentMiddleware<T extends object, Keys extends ODataSelect<T>> = (
  next: Reducer<T, Keys>,
  schemaService: SchemaService<T>,
) => Reducer<T, Keys>;

export type Transformer<T extends object, Keys extends ODataSelect<T>> = (
  reduction: ReductionResults<ODataSelectResult<T, Keys>>,
  results: BackendResults<ODataSelectResult<T, Keys>>,
) => BackendResults<ODataSelectResult<T, Keys>>
export type ResultsMiddleware<T extends object, Keys extends ODataSelect<T>> = (
  next: Transformer<T, Keys>,
  schemaService: SchemaService<T>
) => Transformer<T, Keys>;

export class SearchBackend<T extends object> {
  constructor(
    private readonly schemaService: SchemaService<T>,
    private readonly documentsProvider: () => StoredDocument<T>[],
  ) {
  }

  public search<Keys extends ODataSelect<T>>(request: {
    documentMiddlewares: DocumentMiddleware<T, Keys>[],
    resultsMiddlewares: ResultsMiddleware<T, Keys>[],
  }): BackendResults<ODataSelectResult<T, Keys>> {
    const reducer = [...request.documentMiddlewares]
      .reverse()
      .reduce(
        (acc, cur) => cur(acc, this.schemaService),
        (acc => acc) as Reducer<T, Keys>
      );

    const transformer = [...request.resultsMiddlewares]
      .reverse()
      .reduce(
        (acc, cur) => cur(acc, this.schemaService),
        ((_, cur) => cur) as Transformer<T, Keys>
      );

    const results = this.documentsProvider()
      .map(document => ({
        document,
        globalScore: 0,
        scores: [],
        suggestions: {},
        features: {},
      }))
      .reduce(reducer, { facets: {}, values: [] });

    return transformer(results, { value: [] });
  }
}
