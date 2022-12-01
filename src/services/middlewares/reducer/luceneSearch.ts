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
  SimpleMatches,
} from '../../analyzerService';

export type AnalyzedSearchable = Searchable & QueryAnalyzisResult;
export type SuggestionStrategy<T extends object> =
  (schemaService: SchemaService<T>) => (searchable: AnalyzedSearchable) => (suggestionsAccumulator: unknown[], analyzed: AnalyzedValueFullText, entryMatch: SimpleMatches, entryIndex: number) => void;
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
        const suggestionsAccumulator: unknown[] = [];
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
            for (const ngram of match.ngrams) {
              matchedValues.push(ngram.value);
              matchedLength += ngram.value.length;
            }

            matchedScore += match.score;
            matchCount++;
          }

          searchable.suggester(suggestionsAccumulator, analyzed, matches, i);
        }

        if (matchedValues.length <= 0) {
          continue;
        }

        scores.push({
          key: searchable.name,
          score: matchedScore,
        });

        suggestions[searchable.name] = suggestionsAccumulator;
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
        return () => null;
      }

      return (suggestionsAccumulator, analyzed, entryMatch, entryIndex) => {
        const source = analyzed.normalized[entryIndex];

        for (const match of entryMatch) {
          const lastNgram = match.ngrams[match.ngrams.length - 1];
          const start = match.ngrams[0].index;
          const stop = lastNgram.rindex;

          const value = source.slice(start, stop);
          const leftPadding = source.slice(Math.max(0, start - options.maxPadding), start);
          const rightPadding = source.slice(stop, stop + options.maxPadding);

          suggestionsAccumulator.push(`${leftPadding}${options.preTag}${value}${options.postTag}${rightPadding}`);
        }
      }
    };
  };
}

export function createReplacementSuggestionStrategy<T extends object>(options: {
  highlight: string,
  preTag: string,
  postTag: string,
}): SuggestionStrategy<T> {
  return (schemaService) => {
    const highlightCommand = Parsers.highlight.parse(options.highlight);
    schemaService.assertCommands({ highlightCommand });

    const highlightPaths = highlightCommand.toPaths();

    return (searchable) => {
      if (!highlightPaths.includes(searchable.name)) {
        return () => null;
      }

      return (suggestionsAccumulator, analyzed, entryMatch, entryIndex) => {
        const source = analyzed.normalized[entryIndex];
        let result = source;

        for (let i = entryMatch.length - 1; i >= 0; i--){
          const match = entryMatch[i];
          const lastNgram = match.ngrams[match.ngrams.length - 1];
          const start = match.ngrams[0].index;
          const stop = lastNgram.rindex;

          const value = source.slice(start, stop);

          result = `${result.substring(0, start)}${options.preTag}${value}${options.postTag}${result.substring(stop)}`;
        }

        suggestionsAccumulator.push(result);
      }
    };
  };
}

const autocompleteStrategies: Record<PlainAnalysisMode, (match: NGram[], source: string, entry: NGram[]) => string> = {
  oneTerm: (match) => match[match.length - 1].value,
  twoTerms: (match, source, entry) => {
    const last = match[match.length - 1];
    const peek = entry.find(e => e.index > last.index);
    return peek
      ? `${last.value}${source.slice(last.rindex, peek.index)}${peek.value}`
      : last.value;
  },
  oneTermWithContext: (match) => match[match.length - 1].value,
};
const mappingStrategies: Record<PlainAnalysisMode, (options: {
  query: NGram[],
  search: string,
  preTag: string,
  postTag: string
}) => (suggestion: string) => { text: string, queryPlusText: string }> = {
  oneTerm: (options) => {
    const queryStr = options.query.length > 0
      ? options.search.slice(0, options.query[options.query.length - 1].index)
      : '';
    return (suggestion) => ({
      text: suggestion,
      queryPlusText: `${queryStr}${options.preTag ?? ''}${suggestion}${options.postTag ?? ''}`,
    });
  },
  twoTerms: (options) => mappingStrategies.oneTerm(options),
  oneTermWithContext: (options) => {
    const context = reconstructString(options.search, options.query);
    return (suggestion) => ({
      text: `${context}${suggestion}`,
      queryPlusText: `${options.preTag ?? ''}${context}${suggestion}${options.postTag ?? ''}`,
    });
  }
}

function reconstructString(source: string, query: NGram[]): string {
  if (query.length <= 0) {
    return '';
  }

  const analyzed = [...query];
  const last = analyzed.pop();

  // Cannot depend on context.length since ngram's value.length might not match (rindex - index) when ascii folded.
  let rindex = 0;
  let context = ''
  for (const ngram of analyzed) {
    context += source.slice(rindex, ngram.index) + ngram.value;
    rindex = ngram.rindex;
  }

  return context + source.slice(rindex, last!.index);
}

export function createAutocompleteSuggestionStrategy<T extends object>(options: {
  search: string,
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
    const mappingStrategy = mappingStrategies[options.mode];

    return (searchable) => {
      if (!highlightPaths.includes(searchable.name)) {
        return () => null;
      }

      const mapper = mappingStrategy({ query: searchable.query, ...options });

      return (suggestionsAccumulator, analyzed, entryMatch, entryIndex) => {
        const source = analyzed.normalized[entryIndex];
        const entry = analyzed.entries[entryIndex];

        for (const match of entryMatch) {
          const suggestion = autocompleteStrategy(match.ngrams, source, entry);

          suggestionsAccumulator.push(mapper(suggestion));
        }
      }
    };
  };
}
