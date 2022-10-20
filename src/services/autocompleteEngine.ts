import { _throw } from '../lib/_throw';
import { pipe } from '../lib/functions';
import { filter, flatten, map, sortBy, take, toArray, toIterable, uniq } from '../lib/iterables';

import type { Suggester } from './suggestEngine';
import { SearchEngine } from './searchEngine';

export interface AutoCompleteRequest {
  autocompleteMode?: 'oneTerm' | 'twoTerms' | 'oneTermWithContext';
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

export interface AutoCompleteResult {
  text: string;
  queryPlusText: string;
}
export interface AutoCompleteDocumentResult {
  '@search.coverage'?: number;
  value: AutoCompleteResult[];
}

const internalPreTag = '<@search.ac>';
const internalPostTag = '</@search.ac>';

const matchedPartSeparatorRegEx = /\s+/g;
const suggestedPartSeparatorRegEx = /\s+|$/g;

type AutoCompleteStrategy = (request: AutoCompleteRequest) => (result: string) => AutoCompleteResult;
const autocompleteToCutoffStrategy =
  (getCutoff: (separators: RegExpMatchArray[]) => RegExpMatchArray | undefined): AutoCompleteStrategy =>
    ({ highlightPreTag, highlightPostTag }) =>
      (result) => {
        const matchedPart = result.slice(
          result.indexOf(internalPreTag) + internalPreTag.length,
          result.indexOf(internalPostTag)
        );
        const matchedPartSeparators = Array.from(matchedPart.matchAll(matchedPartSeparatorRegEx));
        const lastMatchedWordSeparator = matchedPartSeparators[matchedPartSeparators.length - 1];
        const lastMatchedWord = lastMatchedWordSeparator
          ? matchedPart.slice((lastMatchedWordSeparator.index ?? 0) + lastMatchedWordSeparator[0].length)
          : matchedPart;

        const suggestedPart = result.slice(
          result.indexOf(internalPostTag) + internalPostTag.length,
        )
        const suggestedPartSeparators = Array.from(suggestedPart.matchAll(suggestedPartSeparatorRegEx));
        const lastSuggestedWordSeparator = getCutoff(suggestedPartSeparators);
        const suggestedWords = lastSuggestedWordSeparator
          ? suggestedPart.slice(0, lastSuggestedWordSeparator.index)
          : suggestedPart;

        return {
          text: `${lastMatchedWord}${suggestedWords}`,
          queryPlusText: `${highlightPreTag ?? ''}${matchedPart}${highlightPostTag ?? ''}${suggestedWords}`
        };
      };

const oneTermStrategy: AutoCompleteStrategy = autocompleteToCutoffStrategy((s) => s[0]);
const twoTermsStrategy: AutoCompleteStrategy = autocompleteToCutoffStrategy((s) => s[1] ?? s[0]);
const oneTermWithContextStrategy: AutoCompleteStrategy = () => _throw(new Error('oneTermWithContext autocompleteMode is not supported.'));

const autocompleteModes: Record<string, AutoCompleteStrategy> = {
  oneTerm: oneTermStrategy,
  twoTerms: twoTermsStrategy,
  oneTermWithContext: oneTermWithContextStrategy,
}

const defaultPageSize = 5;
const maxPageSize = 100;

export class AutocompleteEngine<T extends object> {
  constructor(
    private searchEngine: SearchEngine<T>,
    private suggesterProvider: (name: string) => Suggester,
  ) {
  }

  public autocomplete(request: AutoCompleteRequest): AutoCompleteDocumentResult {
    const top = request.top && Math.min(request.top, maxPageSize) || defaultPageSize;

    const searchResults = this.searchEngine.search({
      filter: request.filter,
      highlight: request.searchFields ?? this.suggesterProvider(request.suggesterName).fields,
      highlightPreTag: internalPreTag,
      highlightPostTag: internalPostTag,
      minimumCoverage: request.minimumCoverage ?? 80,
      search: request.search,
      searchFields: request.searchFields,
      top,
    });

    const coverage = (request.minimumCoverage ? { '@search.coverage': searchResults['@search.coverage'] } : {});

    const strategy = autocompleteModes[request.autocompleteMode ?? 'oneTerm'](request);
    const results = pipe(
      searchResults.value,
      map(({
             ['@search.highlights']: highlights,
             ['@search.features']: features
           }) => pipe(
        toIterable(highlights),
        filter(([k]) => !k.endsWith('@odata.type')),
        sortBy(([k]) => features[k].similarityScore, sortBy.desc),
        map(([,highlight]) => pipe(
          highlight,
          map((v) => strategy(v)),
          uniq(r => r.queryPlusText),
        )),
        flatten,
      )),
      flatten,
      take(top),
      toArray,
    );

    return {
      ...coverage,
      value: results,
    };
  }
}