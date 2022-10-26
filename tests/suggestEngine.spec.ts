import { describe, expect, it } from 'vitest';

import type { People } from './lib/mockSchema';
import { peopleSchemaKey, peopleSchemaService, peopleSuggesterProvider } from './lib/mockSchema';

import { SuggestEngine, SearchBackend } from '../src';

function createEmpty() {
  return new SuggestEngine(
    new SearchBackend<People>(peopleSchemaService, () => []),
    () => peopleSchemaKey,
    peopleSuggesterProvider,
  );
}
function createBasic() {
  return new SuggestEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => [
        { id: '1', fullName: 'foo' },
        { id: '2', fullName: 'bar' },
        { id: '3', fullName: 'biz' },
        { id: '4', fullName: 'buzz' },
      ]
    ),
    () => peopleSchemaKey,
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

  return new SuggestEngine<People>(
    new SearchBackend<People>(
      peopleSchemaService,
    () => [document],
    ),
    () => peopleSchemaKey,
    peopleSuggesterProvider,
  );
}
function createLargeDataSet() {
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

describe('SuggestEngine', () => {
  describe('suggest', () => {
    it('should return nothing when empty', () => {
      const sut = createEmpty();

      const results = sut.suggest({ suggesterName: 'sg', search: '.*' });

      expect(results.value).toEqual([]);
    });

    it('should return matching search as regex', () => {
      const sut = createBasic();

      const results = sut.suggest({ suggesterName: 'sg', search: 'b[ai]' });

      expect(results.value).toEqual([
        { '@search.text': 'bar', id: '2' },
        { '@search.text': 'biz', id: '3' },
      ]);
    });
  });

  describe('searchFields', () => {
    it('should only search in searchFields', () => {
      const sut = createBasic();

      const results = sut.suggest({ suggesterName: 'sg', search: '1|b', searchFields: 'id' });

      expect(results.value).toEqual([
        { '@search.text': '1', id: '1' },
      ]);
    });

    it('should search in all provided searchFields', () => {
      const sut = createBasic();

      const results = sut.suggest({ suggesterName: 'sg', search: '1|b', searchFields: 'id, fullName' });

      expect(results.value).toEqual([
        { '@search.text': '1', id: '1' },
        { '@search.text': 'bar', id: '2' },
        { '@search.text': 'biz', id: '3' },
        { '@search.text': 'buzz', id: '4' },
      ]);
    });
  });

  describe('select', () => {
    it('should include only the key field by default', () => {
      const sut = createComplex();

      const results = sut.suggest({ suggesterName: 'sg', search: 'adr1' });

      expect(results.value).toEqual([{
        '@search.text': 'adr1',
        id: '1',
      }]);
    });

    it('should include all properties on wildcard', () => {
      const sut = createComplex();

      const results = sut.suggest({ suggesterName: 'sg', search: 'adr1', select: ['*'] });

      expect(results.value).toEqual([{
        '@search.text': 'adr1',
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
      }]);
    });

    it('should only include requested properties', () => {
      const sut = createComplex();

      const results = sut.suggest({ suggesterName: 'sg', search: 'adr1', select: ['id', 'addresses/kind', 'phones', 'metadata/deleted'] });

      expect(results.value).toEqual([{
        '@search.text': 'adr1',
        id: '1',
        addresses: [
          { kind: 'home' },
          { kind: 'work' },
        ],
        phones: ['123', '456'],
        metadata: {
          deleted: false,
        },
      }]);
    });
  });

  describe('limiter', () => {
    it('should limit results to 5 items per page by default', () => {
      const sut = createLargeDataSet();

      const results = sut.suggest({ suggesterName: 'sg', search: '[13579]' });

      expect(results.value.length).toBe(5);
    });

    it('should limit results to 100 items per page max', () => {
      const sut = createLargeDataSet();

      const results = sut.suggest({ suggesterName: 'sg', search: '[13579]', top: Number.MAX_SAFE_INTEGER });

      expect(results.value.length).toBe(100);
    });
  });

  describe('coverage', () => {
    it('should not include coverage by default', () => {
      const sut = createEmpty();

      const results = sut.suggest({ suggesterName: 'sg', search: '.*' });

      expect(results['@search.coverage']).toBe(undefined);
    });

    it('should include coverage when minimum is requested', () => {
      const sut = createEmpty();

      const results = sut.suggest({  suggesterName: 'sg', search: '.*', minimumCoverage: 75 });

      // Coverage is hard-coded to 100% in the emulator since the data isn't sharded.
      expect(results['@search.coverage']).toBe(100);
    });
  });
});