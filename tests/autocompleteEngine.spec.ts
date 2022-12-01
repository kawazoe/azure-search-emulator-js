import { describe, expect, it } from 'vitest';

import type { People } from './lib/mockSchema';
import {
  peopleSchemaService,
  peopleSuggesterProvider,
  peopleToStoredDocument
} from './lib/mockSchema';

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
        peopleToStoredDocument({ id: '1', fullName: 'foo' }),
        peopleToStoredDocument({ id: '2', fullName: 'bar' }),
        peopleToStoredDocument({ id: '3', fullName: 'biz' }),
        peopleToStoredDocument({ id: '4', fullName: 'buzz' }),
      ]
    ),
    peopleSuggesterProvider,
  );
}
function createComplex() {
  const document:People = {
    id: '1',
    fullName: 'foo',
    ratio: 0.5,
    income: 400,
    addresses: [
      {
        parts: 'adr1',
        kind: 'home',
      },
      {
        parts: 'adr2',
        kind: 'work',
      }
    ],
    phones: ['123', '456'],
    metadata: {
      createdBy: 'mock1',
      createdOn: new Date(1970, 1, 1),
      deleted: false,
      editCounter: 3,
    }
  };

  return new AutocompleteEngine<People>(
    new SearchBackend<People>(
      peopleSchemaService,
      () => [peopleToStoredDocument(document)],
    ),
    peopleSuggesterProvider,
  );
}
function createLongData() {
  return new AutocompleteEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => [
        peopleToStoredDocument({ id: '1', fullName: 'a longer   fullname with a repeating word' }),
        peopleToStoredDocument({ id: '2', fullName: 'some \t very long \t name' }),
        peopleToStoredDocument({ id: '3', fullName: 'a value' }),
      ]
    ),
    peopleSuggesterProvider,
  );
}
function createLargeDataSet() {
  const documents = Array.from(new Array(2_500))
    .map((_, i) => peopleToStoredDocument({ id: `${i}`, fullName: `${i}`.split('').join(' ') }));

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

      const results = sut.autocomplete({ suggesterName: 'sg', search: '' });

      expect(results.value).toEqual([]);
    });

    it('should return suggestions starting with the search term', () => {
      const sut = createBasic();

      const results = sut.autocomplete({ suggesterName: 'sg', search: 'ba' });

      expect(results.value).toEqual([
        { text: 'bar', queryPlusText: 'bar' },
      ]);
    });

    it('should complete only the last word in oneTerm mode', () => {
      const sut = createLongData();

      const results = sut.autocomplete({ suggesterName: 'sg', search: 'a long', highlightPreTag: 'PRE', highlightPostTag: 'POST' });

      expect(results.value).toEqual([
        { text: 'longer', queryPlusText: 'a PRElongerPOST' },
        { text: 'long', queryPlusText: 'a PRElongPOST' },
      ]);
    });

    it('should complete the last and next word in twoTerm mode', () => {
      const sut = createLongData();

      const results = sut.autocomplete({ suggesterName: 'sg', search: 'a long', autocompleteMode: 'twoTerms', highlightPreTag: 'PRE', highlightPostTag: 'POST' });

      expect(results.value).toEqual([
        { text: 'longer   fullname', queryPlusText: 'a PRElonger   fullnamePOST' },
        { text: 'long \t name', queryPlusText: 'a PRElong \t namePOST' },
      ]);
    });

    it('should complete only the last word oneTermWithContext mode', () => {
      const sut = createLongData();

      const results = sut.autocomplete({ suggesterName: 'sg', search: 'a long', autocompleteMode: 'oneTermWithContext', highlightPreTag: 'PRE', highlightPostTag: 'POST' });

      expect(results.value).toEqual([
        { text: 'a longer', queryPlusText: 'PREa longerPOST' },
      ]);
    });

    it('should include the whole query in results', () => {
      const sut = createLongData();

      const results = sut.autocomplete({ suggesterName: 'sg', search: 'a lon' });

      expect(results.value).toEqual([
        { text: 'longer', queryPlusText: 'a longer' },
        { text: 'long', queryPlusText: 'a long' },
      ]);
    });
  });

  describe('searchFields', () => {
    it('should only search in searchFields', () => {
      const sut = createComplex();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '1', searchFields: 'id' });

      expect(results.value).toEqual([
        { text: '1', queryPlusText: '1' },
      ]);
    });

    it('should search in all provided searchFields', () => {
      const sut = createComplex();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '1', searchFields: 'id, phones' });

      expect(results.value).toEqual([
        { text: '1', queryPlusText: '1' },
        { text: '123', queryPlusText: '123' },
      ]);
    });
  });

  describe('limiter', () => {
    it('should limit results to 5 items per page by default', () => {
      const sut = createLargeDataSet();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '1' });

      expect(results.value.length).toBe(5);
    });

    it('should limit results to 100 items per page max', () => {
      const sut = createLargeDataSet();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '1', top: Number.MAX_SAFE_INTEGER });

      expect(results.value.length).toBe(100);
    });
  });

  describe('coverage', () => {
    it('should not include coverage by default', () => {
      const sut = createEmpty();

      const results = sut.autocomplete({ suggesterName: 'sg', search: '' });

      expect(results['@search.coverage']).toBe(undefined);
    });

    it('should include coverage when minimum is requested', () => {
      const sut = createEmpty();

      const results = sut.autocomplete({  suggesterName: 'sg', search: '', minimumCoverage: 75 });

      // Coverage is hard-coded to 100% in the emulator since the data isn't sharded.
      expect(results['@search.coverage']).toBe(100);
    });
  });
});