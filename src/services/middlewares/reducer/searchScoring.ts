import type { DeepKeyOf, ODataSelect } from '../../../lib/odata';
import { sum, uniq } from '../../../lib/iterables';
import { _throw } from '../../../lib/_throw';

import type { FlatSchemaEntry } from '../../schema';
import { SchemaService } from '../../schema';
import * as Parsers from '../../../parsers';
import type { ScoringBases } from '../../scorer';
import type { ParsedValue } from '../../analyzis';
import type { DocumentMiddleware, SearchFeatures, SearchSuggestions } from '../../searchBackend';

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
      ? schemaService.searchableSchema.filter((e) => searchFieldPaths.includes(e.key))
      : schemaService.searchableSchema;

    const searchRegex = new RegExp(options.search, 'g');

    const suggestionStrategy = options.suggestionStrategy(schemaService);

    return (acc, cur) => {
      let scores: ScoringBases<T> = [];
      let suggestions: SearchSuggestions = {};
      let features: SearchFeatures = {};

      // TODO: Replace tuple with object for readability
      for (const searchable of searchables) {
        const parsed: ParsedValue | undefined = cur.document.parsed[searchable.key as DeepKeyOf<T>];
        if (parsed == null || !(parsed.kind === 'text' || parsed.kind === 'generic')) {
          continue;
        }

        // TODO: create a search pattern that integrates the searchAnalyzer
        console.log(searchRegex, parsed.tokens);

        const matches = parsed.tokens
          .flatMap(tokens => tokens
            .flatMap(t => Array.from(t.matchAll(searchRegex)))
            .filter(m => !!m[0])
            .map(m => ({ match: m[0], index: m.index ?? 0, input: m.input ?? '' } as SearchMatch))
          );

        if (matches.length <= 0) {
          continue;
        }

        scores.push({
          key: searchable.key,
          score: sum(matches.map(t => (1 - t.index / t.input.length) * t.match.length)),
        });

        const uniqueMatches = uniq(matches, m => m.match);
        const matchedLength = sum(matches.map(t => t.match.length));
        const similarityScore = parsed.length === 0 ? 0 : (matchedLength / parsed.length);

        suggestions[searchable.key] = suggestionStrategy(searchable, uniqueMatches);
        features[searchable.key] = {
          uniqueTokenMatches: uniqueMatches.length,
          similarityScore,
          termFrequency: matches.length,
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

    return (entry, matches) => {
      if (!highlightPaths.includes(entry.key)) {
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

    return (entry, matches) => {
      if (!highlightPaths.includes(entry.key)) {
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