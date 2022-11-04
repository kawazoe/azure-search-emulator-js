import { bench, describe } from 'vitest';

import { AutocompleteEngine, Scorer, SearchBackend, SearchEngine, SuggestEngine } from '../src';

import type { People } from './lib/mockSchema';
import {
  hydrateParsedProxies,
  peopleSchemaKey,
  peopleSchemaService,
  peopleSuggesterProvider,
  peopleToStoredDocument
} from './lib/mockSchema';

function createLargeDataSet() {
  return Array.from(new Array(1234))
    .map((_, i) => {
      const doc = peopleToStoredDocument({ id: `${i}`, fullName: `${i}` });
      hydrateParsedProxies(doc.parsed);
      return doc;
    });
}

function createSearchEngine() {
  const documents = createLargeDataSet();

  return new SearchEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => documents
    ),
    new Scorer([], null),
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

describe.only('SearchEngine', () => {
  const sut = createSearchEngine();

  bench('large query', () => {
    sut.search({ search: '[13579]', top: Number.MAX_SAFE_INTEGER });
  });
});

describe('SuggestEngine', () => {
  const sut = createSuggestEngine();

  bench('large query', () => {
    sut.suggest({ search: '[13579]', suggesterName: 'sg', top: Number.MAX_SAFE_INTEGER });
  });
});

describe('AutocompleteEngine', () => {
  const sut = createAutocompleteEngine();

  bench('large query', () => {
    sut.autocomplete({ search: '[13579]', suggesterName: 'sg', top: Number.MAX_SAFE_INTEGER });
  });
});