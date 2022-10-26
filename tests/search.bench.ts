import { bench, describe } from 'vitest';
import { AutocompleteEngine, SearchBackend, SearchEngine, SuggestEngine } from '../src';
import { People, peopleSchemaKey, peopleSchemaService, peopleSuggesterProvider } from './lib/mockSchema';

function createSearchEngine() {
  const documents = Array.from(new Array(1234))
    .map((_, i) => ({ id: `${i}`, fullName: `${i}` }));

  return new SearchEngine(new SearchBackend<People>(
    peopleSchemaService,
    () => documents
  ));
}

function createSuggestEngine() {
  const documents = Array.from(new Array(1234))
    .map((_, i) => ({ id: `${i}`, fullName: `${i}` }));

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
  const documents = Array.from(new Array(1234))
    .map((_, i) => ({ id: `${i}`, fullName: `${i}` }));

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