import { describe, expect, it } from 'vitest';

import type { People } from './lib/mockSchema';
import { peopleSchemaService, peopleToStoredDocument } from './lib/mockSchema';

import type { SearchDocumentMeta } from '../src';
import { SearchEngine, SearchBackend, Scorer } from '../src';

function createEmpty() {
  return new SearchEngine(
    new SearchBackend<People>(peopleSchemaService, () => []),
    new Scorer(peopleSchemaService, [], null),
  );
}
function createBasic() {
  return new SearchEngine(
    new SearchBackend<People>(
    peopleSchemaService,
    () => [
        peopleToStoredDocument({ id: '1', fullName: 'foo' }),
        peopleToStoredDocument({ id: '2', fullName: 'bar' }),
        peopleToStoredDocument({ id: '3', fullName: 'biz' }),
        peopleToStoredDocument({ id: '4', fullName: 'buzz' }),
      ]
    ),
    new Scorer(peopleSchemaService, [], null),
  );
}
function createMultiWords() {
  return new SearchEngine(
    new SearchBackend<People>(
    peopleSchemaService,
    () => [
        peopleToStoredDocument({ id: '1', fullName: 'f o o' }),
        peopleToStoredDocument({ id: '2', fullName: 'b a r' }),
        peopleToStoredDocument({ id: '3', fullName: 'b i z' }),
        peopleToStoredDocument({ id: '4', fullName: 'b u z z' }),
      ]
    ),
    new Scorer(peopleSchemaService, [], null),
  );
}
function createComplex(scorer?: Scorer<People>) {
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

  return new SearchEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => [peopleToStoredDocument(document)],
    ),
    scorer ?? new Scorer<People>(peopleSchemaService, [], null),
  );
}
function createFacetable() {
  return new SearchEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => [
        peopleToStoredDocument({ id: '1', fullName: 'foo', income: 400, addresses: [{ parts: 'adr1', kind: 'home' }] }),
        peopleToStoredDocument({ id: '2', fullName: 'bar', income: 700, addresses: [{ parts: 'adr2', kind: 'home' }] }),
        peopleToStoredDocument({ id: '3', fullName: 'biz', income: 400, addresses: [{ parts: 'adr3', kind: 'work' }] }),
        peopleToStoredDocument({ id: '4', fullName: 'buzz', income: 70, addresses: [{ parts: 'adr4', kind: 'home' }] }),
      ]
    ),
    new Scorer(peopleSchemaService, [], null),
  );
}
function createLargeDataSet() {
  const documents = Array.from(new Array(2_500))
    .map((_, i) => peopleToStoredDocument({ id: `${i}`, fullName: `${i}`.split('').join(' ') }));

  return new SearchEngine(
    new SearchBackend<People>(
      peopleSchemaService,
      () => documents
    ),
    new Scorer(peopleSchemaService, [], null),
  );
}

function stripSearchMeta<T extends object>({
  ['@search.score']: score,
  ['@search.highlights']: highlights,
  ['@search.features']: features,
  ...rest
}: T & SearchDocumentMeta): T {
  return rest as T;
}

describe('SearchEngine', () => {
  describe('search', () => {
    it('should return nothing when empty', () => {
      const sut = createEmpty();

      const results = sut.search({});

      expect(results.value).toEqual([]);
    });

    it('should return matching search as simple query', () => {
      const sut = createBasic();

      const results = sut.search({ search: 'bar|biz' });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '2', fullName: 'bar' },
        { id: '3', fullName: 'biz' },
      ]);
    });
  });

  describe('searchFields', () => {
    it('should only search in searchFields', () => {
      const sut = createBasic();

      const results = sut.search({ search: '1|b*', searchFields: 'id' });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '1', fullName: 'foo' },
      ]);
    });

    it('should search in all provided searchFields', () => {
      const sut = createBasic();

      const results = sut.search({ search: '1|b*', searchFields: 'id, fullName' });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '1', fullName: 'foo' },
        { id: '2', fullName: 'bar' },
        { id: '3', fullName: 'biz' },
        { id: '4', fullName: 'buzz' },
      ]);
    });
  });

  describe('select', () => {
    it('should include all properties by default', () => {
      const sut = createComplex();

      const results = sut.search({});

      expect(results.value.map(stripSearchMeta)).toEqual([{
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

    it('should include all properties on wildcard', () => {
      const sut = createComplex();

      const results = sut.search({ select: ['*'] });

      expect(results.value.map(stripSearchMeta)).toEqual([{
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

      const results = sut.search({ select: ['id', 'addresses/kind', 'phones', 'metadata/deleted'] });

      expect(results.value.map(stripSearchMeta)).toEqual([{
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

  describe('score', () => {
    it('should produce search score based on match length', () => {
      const sut = createBasic();

      const results = sut.search({ search: 'ba*' });

      // 2 for /ba/ at index 0 of bar
      expect(results.value[0]['@search.score']).toBe(2);
    });

    it('should produce search score based on token count and location', () => {
      const sut = createMultiWords();

      const results = sut.search({ search: 'z' });

      // found ["z"] in ["b","u","z","z"] at 4 for 1 out of 7 scored 0.4285714285714286
      // found ["z"] in ["b","u","z","z"] at 6 for 1 out of 7 scored 0.1428571428571429
      expect(results.value[0]['@search.score']).toBeCloseTo(0.57);
      // found ["z"] in ["b","i","z"] at 4 for 1 out of 5 scored 0.19999999999999996
      expect(results.value[1]['@search.score']).toBeCloseTo(0.2);
    });
  });

  describe('features', () => {
    it('should produce search features for each match', () => {
      const sut = createBasic();

      const results = sut.search({ search: '2|bar' });

      const features = results.value[0]['@search.features'];
      expect(features).toHaveProperty('id');
      expect(features).toHaveProperty('fullName');
    });

    it('should produce search features based on search matches', () => {
      const sut = createMultiWords();

      const results = sut.search({ search: '"f o"|o' });

      const feature = results.value[0]['@search.features']['fullName'];
      // matched "f o" and "o" : 2 ngrams
      expect(feature.uniqueTokenMatches).toBe(2);
      // "f o" matched "f"+"o" ngrams for length 2, "o" matched "o"+"o" ngrams for length 2 : 4 / 3  ngrams
      expect(feature.similarityScore).toBe(4/3);
      // matched "f o", "o", and "o" : 3 ngrams
      expect(feature.termFrequency).toBe(3);
    });
  });

  describe('highlights', () => {
    it('should produce search highlights', () => {
      const sut = createMultiWords();

      const results = sut.search({ search: '"f o"|o', highlight: 'fullName' });

      const highlights = results.value[0]['@search.highlights'];
      expect(highlights['fullName']).toEqual(['<em>f o</em> o', 'f <em>o</em> o', 'f o <em>o</em>']);
    });

    it('should use search highlights pre/post fixes', () => {
      const sut = createMultiWords();

      const results = sut.search({ search: '"f o"|o', highlight: 'fullName', highlightPostTag: 'POST', highlightPreTag: 'PRE' });

      const highlights = results.value[0]['@search.highlights'];
      expect(highlights['fullName']).toEqual(['PREf oPOST o', 'f PREoPOST o', 'f o PREoPOST']);
    });
  });

  describe('limiter', () => {
    it('should limit results to 50 items per page by default', () => {
      const sut = createLargeDataSet();

      const results = sut.search({ search: '1|3|5|7|9' });

      expect(results.value.length).toBe(50);
    });

    it('should limit results to 1000 items per page max', () => {
      const sut = createLargeDataSet();

      const results = sut.search({ search: '1|3|5|7|9', top: Number.MAX_SAFE_INTEGER });

      expect(results.value.length).toBe(1000);
    });

    it('should not provide info for next page when empty', () => {
      const sut = createEmpty();

      const results = sut.search({});

      expect(results['@search.nextPageParameters']).toBe(undefined);
      expect(results['@odata.nextLink']).toBe(undefined);
    });

    it('should not provide info for next page when all results fit on a single page', () => {
      const sut = createBasic();

      const results = sut.search({ search: 'ba|bi' });

      expect(results['@search.nextPageParameters']).toBe(undefined);
      expect(results['@odata.nextLink']).toBe(undefined);
    });

    it('should provide info for next page when more than one page', () => {
      const sut = createLargeDataSet();

      const results = sut.search({ search: '1|3|5|7|9', top: 1500 });

      expect(results['@search.nextPageParameters']).toEqual({ search: '1|3|5|7|9', skip: 1000, top: 500 });
      expect(results['@odata.nextLink']).toBe('search=1%7C3%7C5%7C7%7C9&%24skip=1000&%24top=500');
    });
  });

  describe('filter', () => {
    it('should return nothing when empty', () => {
      const sut = createEmpty();

      const results = sut.search({ filter: "fullName eq 'bar'" });

      expect(results.value).toEqual([]);
    });

    it('should return matching filter', () => {
      const sut = createBasic();

      const results = sut.search({ filter: "fullName eq 'bar'" });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '2', fullName: 'bar' },
      ]);
    });

    it('should return matching filter and still consider search', () => {
      const sut = createBasic();

      const results = sut.search({ search: 'b*', filter: 'id lt 4' });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '2', fullName: 'bar' },
        { id: '3', fullName: 'biz' },
      ]);
    });

    it('should impact search score', () => {
      const sut = createBasic();

      const results = sut.search({ search: 'ba*', filter: "fullName eq 'bar'" });

      // 1 for `eq`, 2 for "ba"
      expect(results.value[0]['@search.score']).toEqual(3);
    });

    it('should raise score as matches gets more complex', () => {
      const sut = createBasic();

      const results = sut.search({ filter: "fullName eq 'bar' or id lt 3 and id gt 1" });

      // 2 for `and`, 1 for `or`, 1 for `eq`
      expect(results.value[0]['@search.score']).toEqual(4);
    });
  });

  describe('count', () => {
    it('should return nothing when empty', () => {
      const sut = createEmpty();

      const results = sut.search({});

      expect(results['@odata.count']).toBe(undefined);
    });

    it('should include count when requested', () => {
      const sut = createEmpty();

      const results = sut.search({ count: true });

      expect(results['@odata.count']).toBe(0);
    });

    it('should match returned results length when query fits in a single page', () => {
      const sut = createBasic();

      const results = sut.search({ count: true, search: 'bar|biz' });

      expect(results['@odata.count']).toBe(2);
    });

    it('should match total results length across all pages on large queries', () => {
      const sut = createLargeDataSet();

      const results = sut.search({ count: true, search: '1|3|5|7|9' });

      expect(results['@odata.count']).toBe(2300);
    });
  });

  describe('orderBy', () => {
    it('should return nothing when empty', () => {
      const sut = createEmpty();

      const results = sut.search({ orderBy: 'fullName' });

      expect(results.value).toEqual([]);
    });

    it('should order results by query', () => {
      const sut = createBasic();

      const results = sut.search({ orderBy: 'fullName' });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '2', fullName: 'bar' },
        { id: '3', fullName: 'biz' },
        { id: '4', fullName: 'buzz' },
        { id: '1', fullName: 'foo' },
      ]);
    });

    it('should order results by query in order', () => {
      const sut = createBasic();

      const results = sut.search({ orderBy: 'fullName desc, id desc' });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '1', fullName: 'foo' },
        { id: '4', fullName: 'buzz' },
        { id: '3', fullName: 'biz' },
        { id: '2', fullName: 'bar' },
      ]);
    });

    it('should order results by meta', () => {
      const sut = createBasic();

      const results = sut.search({ search: 'biz|bu*|b*', orderBy: 'search.score() desc' });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '3', fullName: 'biz' },
        { id: '4', fullName: 'buzz' },
        { id: '2', fullName: 'bar' },
      ]);
    });
  });

  describe('facets', () => {
    it('should not produce facets by default', () => {
      const sut = createFacetable();

      const results = sut.search({});

      expect(results['@search.facets']).toBeUndefined();
    });

    it('should produce facets for requested fields', () => {
      const sut = createFacetable();

      const results = sut.search({ facets: ['income', 'addresses/kind'] });

      expect(results['@search.facets']).toEqual({
        income: [
          { value: '70', count: 1 },
          { value: '400', count: 2 },
          { value: '700', count: 1 },
        ],
        'addresses/kind': [
          { value: 'home', count: 3 },
          { value: 'work', count: 1 },
        ],
      });
    });

    it('should limit facets by query', () => {
      const sut = createFacetable();

      const results = sut.search({ facets: ['income,count:2'] });

      expect(results['@search.facets']).toEqual({
        income: [
          { value: '70', count: 1 },
          { value: '400', count: 2 },
        ],
      });
    });

    it('should sort facets by query', () => {
      const sut = createFacetable();

      const results = sut.search({ facets: ['income,sort:-count', 'addresses/kind,sort:-value'] });

      expect(results['@search.facets']).toEqual({
        income: [
          { value: '400', count: 2 },
          { value: '70', count: 1 },
          { value: '700', count: 1 },
        ],
        'addresses/kind': [
          { value: 'work', count: 1 },
          { value: 'home', count: 3 },
        ],
      });
    });

    it('should apply facet params in order', () => {
      const sut = createFacetable();

      const results = sut.search({ facets: ['income,sort:-count,count:2'] });

      expect(results['@search.facets']).toEqual({
        income: [
          { value: '400', count: 2 },
          { value: '70', count: 1 },
        ],
      });
    });
  });

  describe('coverage', () => {
    it('should not include coverage by default', () => {
      const sut = createEmpty();

      const results = sut.search({});

      expect(results['@search.coverage']).toBe(undefined);
    });

    it('should include coverage when minimum is requested', () => {
      const sut = createEmpty();

      const results = sut.search({ minimumCoverage: 75 });

      // Coverage is hard-coded to 100% in the emulator since the data isn't sharded.
      expect(results['@search.coverage']).toBe(100);
    });
  });

  describe('scoring', () => {
    it('should use scoring strategies when available', () => {
      const sut = createComplex(
        new Scorer<People>(
          peopleSchemaService,
          [{
            name: 'doubleFullName',
            text: {
              weights: {
                fullName: 2,
              },
            }
          }],
          null,
        ),
      );

      const inProfile = sut.search({ search: 'foo', scoringProfile: 'doubleFullName' });
      const outProfile = sut.search({ search: 'home', scoringProfile: 'doubleFullName' });

      expect(inProfile.value[0]['@search.score']).toBe(6);
      expect(outProfile.value[0]['@search.score']).toBe(4);
    });
  });
});