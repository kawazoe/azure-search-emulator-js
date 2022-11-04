import { sortBy, sum, uniq } from '../lib/iterables';
import type { ODataSelect, ODataSelectResult } from '../lib/odata';
import { DeepKeyOf, toODataQuery } from '../lib/odata';
import { _throw } from '../lib/_throw';

import type { FieldDefinition, FlatSchemaEntry, ParsedValue } from './schema';
import { SchemaService } from './schema';
import type { ScoringBases, ScoringStrategies } from './scorer';
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
    scores: ScoringBases<T>,
    suggestions: SearchSuggestions,
    features: SearchFeatures,
  }
) => ReductionResults<ODataSelectResult<T, Keys>>;
export type DocumentMiddleware<T extends object, Keys extends ODataSelect<T>> = (
  next: Reducer<T, Keys>,
  schemaService: SchemaService<T>,
) => Reducer<T, Keys>;

export function useFilterScoring<T extends object, Keys extends ODataSelect<T>>(filter: string): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const filterCommand = Parsers.filter.parse(filter);
    schemaService.assertCommands({filterCommand});

    return (acc, cur) => {
      const score = filterCommand.apply(cur.document.original);

      if (score <= 0) {
        return acc;
      }

      cur.globalScore += score;

      return next(acc, cur);
    };
  }
}

export type SearchMatch = { input: string, match: string, index: number }
export type SuggestionStrategy<T extends object> =
  (schemaService: SchemaService<T>) => (field: FlatSchemaEntry<T>, matches: SearchMatch[]) => unknown[];
export function useSearchScoring<T extends object, Keys extends ODataSelect<T>>(options: {
  search: string,
  searchFields: string,
  suggestionStrategy: SuggestionStrategy<T>,
}): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const searchFieldsCommand = Parsers.search.parse(options.searchFields);
    schemaService.assertCommands({ searchFieldsCommand });

    const searchFieldPaths = searchFieldsCommand.toPaths();
    const searchables = searchFieldPaths.length > 0
      ? schemaService.searchableSchema.filter(([n]) => searchFieldPaths.includes(n))
      : schemaService.searchableSchema;

    const searchRegex = new RegExp(options.search, 'g');

    const suggestionStrategy = options.suggestionStrategy(schemaService);

    return (acc, cur) => {
      let scores: ScoringBases<T> = [];
      let suggestions: SearchSuggestions = {};
      let features: SearchFeatures = {};

      // TODO: Replace tuple with object for readability
      for (const searchable of searchables) {
        const parsed: ParsedValue | undefined = cur.document.parsed[searchable[0] as DeepKeyOf<T>];
        if (parsed == null || !(parsed.kind === 'text' || parsed.kind === 'generic')) {
          continue;
        }

        const matches = parsed.normalized
          .flatMap(str => Array.from(str.matchAll(searchRegex)))
          .filter(m => !!m[0])
          .map(m => ({ match: m[0], index: m.index ?? 0, input: m.input ?? '' } as SearchMatch));

        if (matches.length <= 0) {
          continue;
        }

        scores.push({
          key: searchable[0],
          score: sum(matches.map(t => (1 - t.index / t.input.length) * t.match.length)),
        });

        const uniqueMatches = uniq(matches, m => m.match);
        const valueLength = sum(parsed.normalized.map(v => v.length));
        const matchedLength = sum(matches.map(t => t.match.length));
        const similarityScore = valueLength === 0 ? 0 : (matchedLength / valueLength);

        suggestions[searchable[0]] = suggestionStrategy(searchable, uniqueMatches);
        features[searchable[0]] = {
          uniqueTokenMatches: uniqueMatches.length,
          similarityScore,
          termFrequency: matches.length,
        }
      }

      if (scores.length <= 0) {
        return acc;
      }

      cur.scores = scores;
      cur.suggestions = suggestions;
      cur.features = features;

      return next(acc, cur);
    };
  }
}

export function createHighlightSuggestionStrategy<T extends object>(options: {
  highlight: string,
  preTag: string,
  postTag: string,
  maxPadding: number,
}): SuggestionStrategy<T> {
  return (schemaService) => {
    const highlightCommand = Parsers.highlight.parse(options.highlight);
    schemaService.assertCommands({ highlightCommand });

    const highlightPaths = highlightCommand.toPaths();

    return (field, matches) => {
      if (!highlightPaths.includes(field[0])) {
        return [];
      }

      return matches
        .map(match => {
          const leftPadding = match.input.slice(Math.max(0, match.index - options.maxPadding), match.index);
          const rightPadding = match.input.slice(match.index + match.match.length, match.index + match.match.length + options.maxPadding);
          return `${leftPadding}${options.preTag}${match.match}${options.postTag}${rightPadding}`
        });
    };
  };
}

export type AutocompleteModes = 'oneTerm' | 'twoTerms' | 'oneTermWithContext';

const matchedPartSeparatorRegEx = /\s+/g;
const suggestedPartSeparatorRegEx = /\s+|$/g;

const autocompleteCutoffs: Record<AutocompleteModes, (matches: RegExpMatchArray[]) => RegExpMatchArray | undefined> = {
  oneTerm: (s) => s[0],
  twoTerms: (s) => s[1] ?? s[0],
  oneTermWithContext: () => _throw(new Error('oneTermWithContext autocompleteMode is not supported.')),
};
export function createAutocompleteSuggestionStrategy<T extends object>(options: {
  highlight: string,
  preTag: string,
  postTag: string,
  mode: AutocompleteModes,
}): SuggestionStrategy<T> {
  return (schemaService) => {
    const highlightCommand = Parsers.highlight.parse(options.highlight);
    schemaService.assertCommands({ highlightCommand });

    const highlightPaths = highlightCommand.toPaths();
    const getCutoff = autocompleteCutoffs[options.mode ?? 'oneTerm'];

    return (field, matches) => {
      if (!highlightPaths.includes(field[0])) {
        return [];
      }

      return matches
        .map((match) => {
          const matchedPart = match.match;

          const matchedPartSeparators = Array.from(matchedPart.matchAll(matchedPartSeparatorRegEx));
          const lastMatchedWordSeparator = matchedPartSeparators[matchedPartSeparators.length - 1];
          const lastMatchedWord = lastMatchedWordSeparator
            ? matchedPart.slice((lastMatchedWordSeparator.index ?? 0) + lastMatchedWordSeparator[0].length)
            : matchedPart;

          const suggestedPart = match.input.slice(match.index + match.match.length);
          const suggestedPartSeparators = Array.from(suggestedPart.matchAll(suggestedPartSeparatorRegEx));
          const lastSuggestedWordSeparator = getCutoff(suggestedPartSeparators);
          const suggestedWords = lastSuggestedWordSeparator
            ? suggestedPart.slice(0, lastSuggestedWordSeparator.index)
            : suggestedPart;

          return {
            text: `${lastMatchedWord}${suggestedWords}`,
            queryPlusText: `${options.preTag ?? ''}${matchedPart}${options.postTag ?? ''}${suggestedWords}`
          };
        });
    };
  };
}

export function useSelect<T extends object, Keys extends ODataSelect<T>>(select: Keys[]): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const selectCommand = Parsers.select.parse(select.join(', '));
    schemaService.assertCommands({selectCommand});

    return (acc, cur) => {
      cur.selected = selectCommand.apply(cur.document.original) as ODataSelectResult<T, Keys>;

      return next(acc, cur);
    };
  };
}

export function useFacetExtraction<T extends object, Keys extends ODataSelect<T>>(facets: string[]): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const facetCommands = facets.map(f => Parsers.facet.parse(f));
    schemaService.assertCommands({facetCommands});

    return (acc, cur) => {
      acc.facets = facetCommands.reduce((a, c) => c.apply(a, cur.document.original), acc.facets);

      return next(acc, cur);
    };
  };
}

export function useScoringProfiles<T extends object, Keys extends ODataSelect<T>>(options: {
  scoringStrategies: ScoringStrategies<T>,
}): DocumentMiddleware<T, Keys> {
  return (next) => {
    return (acc, cur) => {
      cur.globalScore += options.scoringStrategies(cur.document.parsed, cur.scores);

      return next(acc, cur);
    };
  };
}

export function useSearchResult<T extends object, Keys extends ODataSelect<T>>(): DocumentMiddleware<T, Keys> {
  return (next) => (acc, cur) => {
    acc.values.push({
      ...cur.selected ?? cur.document.original,
      '@search.score': cur.globalScore,
      '@search.highlights': cur.suggestions,
      '@search.features': cur.features,
    } as unknown as SearchResult<ODataSelectResult<T, Keys>>);

    return next(acc, cur);
  };
}

export function useSuggestResult<T extends object, Keys extends ODataSelect<T>>(): DocumentMiddleware<T, Keys> {
  return (next) => (acc, cur) => {
    const suggestions = Object.entries(cur.suggestions)
      .sort(sortBy(([key]) => cur.features[key].similarityScore, sortBy.desc))
      .flatMap(([, suggestions]) => suggestions
        .map((s) => ({
          '@search.score': cur.globalScore,
          '@search.text': `${s}`,
          ...cur.selected ?? cur.document.original,
        } as SuggestResult<ODataSelectResult<T, Keys>>)),
      );

    acc.values.push(...suggestions);

    return next(acc, cur);
  };
}

export function useAutocompleteResult<T extends object, Keys extends ODataSelect<T>>(): DocumentMiddleware<T, Keys> {
  return (next) => (acc, cur) => {
    const suggestions = Object.entries(cur.suggestions)
      .sort(sortBy(([key]) => cur.features[key].similarityScore, sortBy.desc))
      .flatMap(([, suggestions]) => {
        const results = suggestions
          .map(result => ({
            '@search.score': cur.globalScore,
            ...result as AutocompleteResult,
          }));

        return uniq(results, r => r.queryPlusText);
      });

    acc.values.push(...suggestions);

    return next(acc, cur);
  };
}

export type Transformer<T extends object, Keys extends ODataSelect<T>> = (
  reduction: ReductionResults<ODataSelectResult<T, Keys>>,
  results: BackendResults<ODataSelectResult<T, Keys>>,
) => BackendResults<ODataSelectResult<T, Keys>>
export type ResultsMiddleware<T extends object, Keys extends ODataSelect<T>> = (
  next: Transformer<T, Keys>,
  schemaService: SchemaService<T>
) => Transformer<T, Keys>;

export function useOrderBy<T extends object, Keys extends ODataSelect<T>>(orderBy: string): ResultsMiddleware<T, Keys> {
  return (next, schemaService) => {
    const orderByCommand = Parsers.orderBy.parse(orderBy);
    schemaService.assertCommands({ orderByCommand });

    return (reduction, results) => {
      reduction.values.sort(orderByCommand.apply);

      return next(reduction, results);
    };
  };
}

export function useCount<T extends object, Keys extends ODataSelect<T>>(): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      results['@odata.count'] = reduction.values.length;

      return next(reduction, results);
    };
  };
}

export function useCoverage<T extends object, Keys extends ODataSelect<T>>(): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      results['@search.coverage'] = 100;

      return next(reduction, results);
    };
  };
}

export function useFacetTransformation<T extends object, Keys extends ODataSelect<T>>(): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      const foo = Object.entries(reduction.facets)
        .map(([key, facet]): [string, SearchFacetBase[]] => [
          key,
          (facet.params.sort
            ? Object.entries(facet.results).sort(facet.params.sort)
            : Object.entries(facet.results))
            .slice(0, facet.params.count)
            // TODO: Add support for ranged facets
            .map(([value, count]) => ({value, count} as SearchFacetValue)),
        ]);

      results['@search.facets'] = Object.fromEntries(foo);

      return next(reduction, results);
    };
  };
}

export function usePagingMiddleware<T extends object, Keys extends ODataSelect<T>>(options: {
  skip: number,
  top: number,
  maxPageSize: number,
  request: unknown
}): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      const pageSize = Math.min(options.top, options.maxPageSize);
      const page = reduction.values.slice(options.skip, options.skip + pageSize);

      const nextPageRequest = options.top > options.maxPageSize && reduction.values.length > options.skip + pageSize
        ? {
          ...options.request as any,
          skip: options.skip + pageSize,
          top: options.top - pageSize,
        }
        : undefined;

      if (nextPageRequest) {
        results['@search.nextPageParameters'] = nextPageRequest;
        results['@odata.nextLink'] = toODataQuery(nextPageRequest);
      }

      results.value = page;

      return next(reduction, results);
    };
  };
}
export function useLimiterMiddleware<T extends object, Keys extends ODataSelect<T>>(top: number): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      results.value = reduction.values.slice(0, top);

      return next(reduction, results);
    };
  };
}

export function useStripScore<T extends object, Keys extends ODataSelect<T>>(): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      results.value = (results.value as any[]).map(({['@search.score']: score, ...rest}) => rest) as typeof results.value;

      return next(reduction, results);
    };
  };
}

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
