import { describe, expect, it } from 'vitest';
import { SearchEngine } from '../src/services/searchEngine';
import { flatPeopleSchema, People, peopleSchemaKey } from './lib/mockSchema';
import { SuggestEngine, Suggester } from '../src/services/suggestEngine';
import { _throw } from '../src/lib/_throw';

const suggesters: Record<string, Suggester> = {
  people: {
    fields: flatPeopleSchema
      .filter(([,v]) => v.type === 'Edm.String' || v.type === 'Collection(Edm.String)')
      .map(([k]) => k)
      .join(', ')
  }
}
const suggesterProvider = (name: string) => suggesters[name] ?? _throw(new Error(`Unknown suggester ${name}`));

function createEmpty() {
  return new SuggestEngine(
    new SearchEngine(() => flatPeopleSchema, () => []),
    () => peopleSchemaKey,
    suggesterProvider,
  );
}
function createBasic() {
  return new SuggestEngine(
    new SearchEngine<People>(
      () => flatPeopleSchema,
      () => [
        { id: '1', fullName: 'foo' },
        { id: '2', fullName: 'bar' },
        { id: '3', fullName: 'biz' },
        { id: '4', fullName: 'buzz' },
      ]
    ),
    () => peopleSchemaKey,
    suggesterProvider,
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
    new SearchEngine<People>(
    () => flatPeopleSchema,
    () => [document],
    ),
    () => peopleSchemaKey,
    suggesterProvider,
  );
}
function createLargeDataSet() {
  const documents = Array.from(new Array(1234))
    .map((_, i) => ({ id: `${i}`, fullName: `${i}` }));
  return new SuggestEngine<People>(
    new SearchEngine<People>(
      () => flatPeopleSchema,
      () => documents
    ),
    () => peopleSchemaKey,
    suggesterProvider,
  );
}

describe('SuggestEngine', () => {
  describe('suggest', () => {
    it('should return nothing when empty', () => {
      const sut = createEmpty();

      const results = sut.suggest({ suggesterName: 'people', search: '.*' });

      expect(results.value).toEqual([]);
    });

    it('should return matching search as regex', () => {
      const sut = createBasic();

      const results = sut.suggest({ suggesterName: 'people', search: 'b[ai]' });

      expect(results.value).toEqual([
        { '@search.text': 'bar', id: '2' },
        { '@search.text': 'biz', id: '3' },
      ]);
    });
  });

  describe('searchFields', () => {
    it('should only search in searchFields', () => {
      const sut = createBasic();

      const results = sut.suggest({ suggesterName: 'people', search: '1|b', searchFields: 'id' });

      expect(results.value).toEqual([
        { '@search.text': '1', id: '1' },
      ]);
    });

    it('should search in all provided searchFields', () => {
      const sut = createBasic();

      const results = sut.suggest({ suggesterName: 'people', search: '1|b', searchFields: 'id, fullName' });

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

      const results = sut.suggest({ suggesterName: 'people', search: 'adr1' });

      expect(results.value).toEqual([{
        '@search.text': 'adr1',
        id: '1',
      }]);
    });

    it('should include all properties on wildcard', () => {
      const sut = createComplex();

      const results = sut.suggest({ suggesterName: 'people', search: 'adr1', select: ['*'] });

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

      const results = sut.suggest({ suggesterName: 'people', search: 'adr1', select: ['id', 'addresses/kind', 'phones', 'metadata/deleted'] });

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

      const results = sut.suggest({ suggesterName: 'people', search: '[13579]' });

      expect(results.value.length).toBe(5);
    });

    it('should limit results to 100 items per page max', () => {
      const sut = createLargeDataSet();

      const results = sut.suggest({ suggesterName: 'people', search: '[13579]', top: Number.MAX_SAFE_INTEGER });

      expect(results.value.length).toBe(100);
    });
  });

  describe('coverage', () => {
    it('should not include coverage by default', () => {
      const sut = createEmpty();

      const results = sut.suggest({ suggesterName: 'people', search: '.*' });

      expect(results['@search.coverage']).toBe(undefined);
    });

    it('should include coverage when minimum is requested', () => {
      const sut = createEmpty();

      const results = sut.suggest({  suggesterName: 'people', search: '.*', minimumCoverage: 75 });

      // Coverage is hard-coded to 100% in the emulator since the data isn't sharded.
      expect(results['@search.coverage']).toBe(100);
    });
  });
});