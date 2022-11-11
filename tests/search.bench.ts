import { bench, describe } from 'vitest';

import { AutocompleteEngine, Scorer, SearchBackend, SearchEngine, SuggestEngine } from '../src';

import type { People } from './lib/mockSchema';
import {
  peopleSchemaKey,
  peopleSchemaService,
  peopleSuggesterProvider,
  peopleToStoredDocument
} from './lib/mockSchema';

function createLargeDataSet() {
  return Array.from(new Array(2_500))
    .map((_, i) => peopleToStoredDocument({ id: `${i}`, fullName: `${i}`.split('').join(' ') }));
}

function createSearchEngine() {
  const documents = createLargeDataSet();

  return new SearchEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => documents
    ),
    new Scorer(peopleSchemaService, [], null),
  );
}

function createSuggestEngine() {
  const documents = createLargeDataSet();

  return new SuggestEngine<People>(
    new SearchBackend<People>(
      peopleSchemaService,
      () => documents
    ),
    () => peopleSchemaKey,
    peopleSuggesterProvider,
  );
}

function createAutocompleteEngine() {
  const documents = createLargeDataSet();

  return new AutocompleteEngine<People>(
    new SearchBackend<People>(
      peopleSchemaService,
      () => documents
    ),
    peopleSuggesterProvider,
  );
}

describe('SearchEngine', () => {
  const sut = createSearchEngine();

  bench('large query', () => {
    sut.search({ search: '1|3|5|7|9', top: Number.MAX_SAFE_INTEGER });
  });
});

describe('SuggestEngine', () => {
  const sut = createSuggestEngine();

  bench('large query', () => {
    sut.suggest({ search: '1', suggesterName: 'sg', top: Number.MAX_SAFE_INTEGER });
  });
});

describe('AutocompleteEngine', () => {
  const sut = createAutocompleteEngine();

  bench('large query', () => {
    sut.autocomplete({ search: '1', suggesterName: 'sg', top: Number.MAX_SAFE_INTEGER });
  });
});
