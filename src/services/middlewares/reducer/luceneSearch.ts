import type { ODataSelect } from '../../../lib/odata';
import { uniq } from '../../../lib/iterables';

import type { Searchable } from '../../schema';
import { SchemaService } from '../../schema';
import * as Parsers from '../../../parsers';
import type { ScoringBases } from '../../scorer';
import type { DocumentMiddleware, SearchFeatures, SearchSuggestions } from '../../searchBackend';
import {
  AnalyzedValueFullText,
  NGram,
  PlainAnalysisMode,
  QueryAnalyzisResult,
  QueryingStrategy,
  SimpleMatch,
} from '../../analyzerService';

export type AnalyzedSearchable = Searchable & QueryAnalyzisResult;
export type SuggestionStrategy<T extends object> =
  (schemaService: SchemaService<T>) => (searchable: AnalyzedSearchable) => (analyzed: AnalyzedValueFullText, entryMatch: SimpleMatch, fieldIndex: number) => unknown;
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

    const suggestionStrategy = options.suggestionStrategy(schemaService);
    const searchables = searchableFields
      .map(s => ({ ...s, ...options.queryingStrategy(s.field) }))
      .map(s => ({ ...s, suggester: suggestionStrategy(s) }));

    return (acc, cur) => {
      let scores: ScoringBases = [];
      let suggestions: SearchSuggestions = {};
      let features: SearchFeatures = {};

      for (const searchable of searchables) {
        const analyzed = cur.document.analyzed[searchable.name];

        if (!analyzed || analyzed.kind !== 'fullText') {
          continue;
        }

        const matchedValues: string[] = [];
        const searchableSuggestions: unknown[] = [];
        let matchedLength = 0;
        let matchedScore = 0;
        let matchCount = 0;
        for (let i = 0; i < analyzed.entries.length; i++){
          const entry = analyzed.entries[i];
          const matches = searchable.apply(entry);

          if (matches.length <= 0) {
            continue;
          }

          for (const match of matches) {
            if (match.ngrams.length === 0) {
              continue;
            }

            for (const ngram of match.ngrams) {
              matchedValues.push(ngram.value);
              matchedLength += ngram.value.length;
            }

            matchedScore += match.score;
            matchCount++;

            searchableSuggestions.push(searchable.suggester(analyzed, match, i));
          }
        }

        if (matchedValues.length <= 0) {
          continue;
        }

        scores.push({
          key: searchable.name,
          score: matchedScore,
        });

        suggestions[searchable.name] = searchableSuggestions;
        features[searchable.name] = {
          uniqueTokenMatches: uniq(matchedValues).length,
          similarityScore: analyzed.length === 0 ? 0 : (matchedLength / analyzed.length),
          termFrequency: matchCount,
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

    return (searchable) => {
      if (!highlightPaths.includes(searchable.name)) {
        return () => [];
      }

      return (analyzed: AnalyzedValueFullText, entryMatch: SimpleMatch, fieldIndex: number) => {
        const source = analyzed.normalized[fieldIndex];
        const lastNgram = entryMatch.ngrams[entryMatch.ngrams.length - 1];
        const start = entryMatch.ngrams[0].index;
        const stop = lastNgram.rindex;

        const value = source.slice(start, stop);
        const leftPadding = source.slice(Math.max(0, start - options.maxPadding), start);
        const rightPadding = source.slice(stop, stop + options.maxPadding);

        return `${leftPadding}${options.preTag}${value}${options.postTag}${rightPadding}`;
      }
    };
  };
}

const autocompleteStrategies: Record<PlainAnalysisMode, (entry: NGram[], index: number) => NGram[]> = {
  oneTerm: (entry, index) => [entry[index]],
  twoTerms: (entry, index) => [entry[index], entry[index + 1]],
  oneTermWithContext: (entry, index) => [entry[index]],
};

function extractContext(query: NGram[]): string {
  let str = '';
  for (let i = query.length - 2; i >= 0; i--) {
    str += query[i].value + ' ';
  }
  return str;
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

    return (searchable) => {
      if (!highlightPaths.includes(searchable.name)) {
        return () => [];
      }

      const context = extractContext(searchable.query);

      return (analyzed: AnalyzedValueFullText, entryMatch: SimpleMatch, fieldIndex: number) => {
        const source = analyzed.entries[fieldIndex];
        const lastNgram = entryMatch.ngrams[entryMatch.ngrams.length - 1];

        const suggestionIndex = source.findIndex(ngrams => ngrams.index === lastNgram.index);
        const suggestions = autocompleteStrategy(source, suggestionIndex);

        let suggestion = '';
        for (let i = 0; i < suggestions.length; i++){
          const s = suggestions[i];
          if (s) {
            suggestion += i < suggestions.length - 1
              ? s.value + ' '
              : s.value;
          }
        }

        if (options.mode === 'oneTermWithContext') {
          return {
            text: `${context}${suggestion}`,
            queryPlusText: `${options.preTag ?? ''}${context}${suggestion}${options.postTag ?? ''}`,
          };
        } else {
          return {
            text: suggestion,
            queryPlusText: `${context}${options.preTag ?? ''}${suggestion}${options.postTag ?? ''}`,
          };
        }
      }
    };
  };
}
