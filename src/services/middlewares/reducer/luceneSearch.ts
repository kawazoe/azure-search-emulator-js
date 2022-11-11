import type { ODataSelect } from '../../../lib/odata';
import { sum, uniq } from '../../../lib/iterables';

import type { Searchable } from '../../schema';
import { SchemaService } from '../../schema';
import * as Parsers from '../../../parsers';
import type { ScoringBases } from '../../scorer';
import type { DocumentMiddleware, SearchFeatures, SearchSuggestions } from '../../searchBackend';
import {
  PlainAnalysisMode,
  AnalyzedValueFullText,
  NGram,
  QueryingStrategy,
  SimpleMatches,
  QueryAnalyzisResult
} from '../../analyzerService';

export type AnalyzedSearchable = Searchable & QueryAnalyzisResult;
export type SuggestionStrategy<T extends object> =
  (schemaService: SchemaService<T>) => (searchable: AnalyzedSearchable, analyzed: AnalyzedValueFullText, matches: SimpleMatches[]) => unknown[];
export function useLuceneSearch<T extends object, Keys extends ODataSelect<T>>(options: {
  searchFields: string,
  queryingStrategy: QueryingStrategy,
  suggestionStrategy: SuggestionStrategy<T>,
}): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const searchFieldsCommand = Parsers.search.parse(options.searchFields);
    schemaService.assertCommands({ searchFieldsCommand });

    const searchFieldPaths = searchFieldsCommand.toPaths();
    const searchableFields = searchFieldPaths.length > 0
      ? schemaService.searchableSchema.filter((e) => searchFieldPaths.includes(e.name))
      : schemaService.searchableSchema;

    const searchables: AnalyzedSearchable[] = searchableFields
      .map(s => ({ ...s, ...options.queryingStrategy(s.field) }));

    const suggestionStrategy = options.suggestionStrategy(schemaService);

    return (acc, cur) => {
      let scores: ScoringBases = [];
      let suggestions: SearchSuggestions = {};
      let features: SearchFeatures = {};

      for (const searchable of searchables) {
        const analyzed = cur.document.analyzed[searchable.name];

        if (!analyzed || analyzed.kind !== 'fullText') {
          continue;
        }

        const matches = analyzed.entries.map(searchable.apply);
        const flatMatches = matches.flat();

        if (flatMatches.flatMap(m => m.ngrams).length <= 0) {
          continue;
        }

        scores.push({
          key: searchable.name,
          score: sum(flatMatches.map(m => m.score)),
        });

        const matchedValues = flatMatches
          .flatMap(m => m.ngrams)
          .map(ngram => ngram.value);

        const matchedLength = sum(matchedValues.map(v => v.length));

        suggestions[searchable.name] = suggestionStrategy(searchable, analyzed, matches);
        features[searchable.name] = {
          uniqueTokenMatches: uniq(matchedValues).length,
          similarityScore: analyzed.length === 0 ? 0 : (matchedLength / analyzed.length),
          termFrequency: flatMatches.length,
        };
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

    return (searchable, analyzable, matches) => {
      if (!highlightPaths.includes(searchable.name)) {
        return [];
      }

      return matches
        .flatMap((match, index) => match.map(m => ({
          ngrams: m.ngrams,
          source: analyzable.normalized[index],
          lastNgram: m.ngrams[m.ngrams.length - 1],
        })))
        .filter(m => m.ngrams.length !== 0)
        .map(match => {
          const start = match.ngrams[0].index;
          const stop = match.lastNgram.rindex;

          const value = match.source.slice(start, stop);

          const leftPadding = match.source.slice(Math.max(0, start - options.maxPadding), start);
          const rightPadding = match.source.slice(stop, stop + options.maxPadding);

          return `${leftPadding}${options.preTag}${value}${options.postTag}${rightPadding}`;
        });
    };
  };
}

const autocompleteStrategies: Record<PlainAnalysisMode, (entry: NGram[], index: number) => NGram[]> = {
  oneTerm: (entry, index) => [entry[index]],
  twoTerms: (entry, index) => [entry[index], entry[index + 1]],
  oneTermWithContext: (entry, index) => [entry[index]],
};

function extractContext(query: NGram[]): string {
  const [, ...context] = [...query]
    .reverse();
  const str = context
    .map(n => n.value)
    .join(' ');

  return str.length > 0 ? `${str} ` : str;
}

export function createAutocompleteSuggestionStrategy<T extends object>(options: {
  highlight: string,
  preTag: string,
  postTag: string,
  mode: PlainAnalysisMode,
}): SuggestionStrategy<T> {
  return (schemaService) => {
    const highlightCommand = Parsers.highlight.parse(options.highlight);
    schemaService.assertCommands({ highlightCommand });

    const highlightPaths = highlightCommand.toPaths();

    const autocompleteStrategy = autocompleteStrategies[options.mode];

    return (searchable, analyzable, matches) => {
      if (!highlightPaths.includes(searchable.name)) {
        return [];
      }

      const context = extractContext(searchable.query);

      return matches
        .flatMap((match, index) => match.map(m => ({
          ngrams: m.ngrams,
          entry: analyzable.entries[index],
          lastNgram: m.ngrams[m.ngrams.length - 1],
        })))
        .filter(m => m.ngrams.length !== 0)
        .map((match) => {
          const suggestionIndex = match.entry
            .findIndex(ngrams => ngrams.index === match.lastNgram.index);
          const suggestion = autocompleteStrategy(match.entry, suggestionIndex)
            .filter(n => !!n)
            .map(n => n.value)
            .join(' ');

          if (options.mode === 'oneTermWithContext') {
            return {
              text: `${context}${suggestion}`,
              queryPlusText: `${options.preTag ?? ''}${context}${suggestion}${options.postTag ?? ''}`,
            };
          }

          return {
            text: suggestion,
            queryPlusText: `${context}${options.preTag ?? ''}${suggestion}${options.postTag ?? ''}`,
          };
        });
    };
  };
}
