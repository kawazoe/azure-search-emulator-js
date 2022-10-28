import { describe, expect, it } from 'vitest';

import type { People } from './lib/mockSchema';
import { peopleSchemaService, peopleSuggesterProvider } from './lib/mockSchema';

import { AutocompleteEngine, SearchBackend } from '../src';

function createEmpty() {
  return new AutocompleteEngine(
    new SearchBackend<People>(peopleSchemaService, () => []),
    peopleSuggesterProvider,
  );
}
function createBasic() {
  return new AutocompleteEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => [
        { id: '1', fullName: 'foo' },
        { id: '2', fullName: 'bar' },
        { id: '3', fullName: 'biz' },
        { id: '4', fullName: 'buzz' },
      ]
    ),
    peopleSuggesterProvider,
  );
}
function createLongData() {
  return new AutocompleteEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => [
        { id: '1', fullName: 'a longer   fullname with a repeating word' },
        { id: '2', fullName: 'some \t very long \t name' },
        { id: '3', fullName: 'a value' },
      ]
    ),
    peopleSuggesterProvider,
  );
}
function createLargeDataSet() {
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

describe('AutocompleteEngine', () => {
  describe('autocomplete', () => {
    it('should return nothing when empty', () => {
      const sut = createEmpty();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '.*' });

      expect(results.value).toEqual([]);
    });

    it('should return matching search as regex', () => {
      const sut = createBasic();

      const results = sut.autocomplete({ suggesterName: 'sg', search: 'b[ai]' });

      expect(results.value).toEqual([
        { text: 'bar', queryPlusText: 'bar' },
        { text: 'biz', queryPlusText: 'biz' },
      ]);
    });

    it('should complete only the first word in oneTerm mode', () => {
      const sut = createLongData();

      const results = sut.autocomplete({ suggesterName: 'sg', search: 'long' });

      expect(results.value).toEqual([
        { text: 'longer', queryPlusText: 'longer' },
        { text: 'long', queryPlusText: 'long' },
      ]);
    });

    it('should complete up to two words in twoTerm mode', () => {
      const sut = createLongData();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '(very|a) long', autocompleteMode: 'twoTerms' });

      expect(results.value).toEqual([
        { text: 'long \t name', queryPlusText: 'very long \t name' },
        { text: 'longer   fullname', queryPlusText: 'a longer   fullname' },
      ]);
    });

    it('should include the whole query in results', () => {
      const sut = createLongData();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '(very|a) lon' });

      expect(results.value).toEqual([
        { text: 'long', queryPlusText: 'very long' },
        { text: 'longer', queryPlusText: 'a longer' },
      ]);
    });
  });

  describe('searchFields', () => {
    it('should only search in searchFields', () => {
      const sut = createBasic();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '1|b', searchFields: 'id' });

      expect(results.value).toEqual([
        { text: '1', queryPlusText: '1' },
      ]);
    });

    it('should search in all provided searchFields', () => {
      const sut = createBasic();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '1|b', searchFields: 'id, fullName' });

      expect(results.value).toEqual([
        { text: '1', queryPlusText: '1' },
        { text: 'bar', queryPlusText: 'bar' },
        { text: 'biz', queryPlusText: 'biz' },
        { text: 'buzz', queryPlusText: 'buzz' },
      ]);
    });
  });

  describe('limiter', () => {
    it('should limit results to 5 items per page by default', () => {
      const sut = createLargeDataSet();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '[13579]' });

      expect(results.value.length).toBe(5);
    });

    it('should limit results to 100 items per page max', () => {
      const sut = createLargeDataSet();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '[13579]', top: Number.MAX_SAFE_INTEGER });

      expect(results.value.length).toBe(100);
    });
  });

  describe('coverage', () => {
    it('should not include coverage by default', () => {
      const sut = createEmpty();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '.*' });

      expect(results['@search.coverage']).toBe(undefined);
    });

    it('should include coverage when minimum is requested', () => {
      const sut = createEmpty();

      const results = sut.autocomplete({  suggesterName: 'sg', search: '.*', minimumCoverage: 75 });

      // Coverage is hard-coded to 100% in the emulator since the data isn't sharded.
      expect(results['@search.coverage']).toBe(100);
    });
  });
});