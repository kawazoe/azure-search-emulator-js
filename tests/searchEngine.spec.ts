import { describe, expect, it } from 'vitest';
import { SearchDocumentMeta, SearchEngine } from '../src/services/searchEngine';
import { flatPeopleSchema, People } from './lib/mockSchema';

function createEmpty() {
  return new SearchEngine(() => flatPeopleSchema, () => []);
}
function createBasic() {
  return new SearchEngine<People>(
    () => flatPeopleSchema,
    () => [
      { id: '1', fullName: 'foo' },
      { id: '2', fullName: 'bar' },
      { id: '3', fullName: 'biz' },
      { id: '4', fullName: 'buzz' },
    ]
  );
}
function createLargeDataSet() {
  const documents = Array.from(new Array(1234))
    .map((_, i) => ({ id: `${i}`, fullName: `${i}` }));
  return new SearchEngine<People>(
    () => flatPeopleSchema,
    () => documents
  );
}

describe('SearchEngine', () => {
  describe('results', () => {
    function stripSearchMeta<T extends object>({
      ['@search.features']: features,
      ['@search.highlights']: highlights,
      ['@search.score']: score,
      ...rest
    }: T & SearchDocumentMeta): T {
      return rest as T;
    }

    it('should return nothing when empty', () => {
      const sut = createEmpty();

      const results = sut.search({});

      expect(results.value).toEqual([]);
    });

    it('should return matching search as regex', () => {
      const sut = createBasic();

      const results = sut.search({ search: 'b[ai]' });

      expect(results.value.map(stripSearchMeta)).toEqual([
        { id: '2', fullName: 'bar' },
        { id: '3', fullName: 'biz' },
      ]);
    });

    it('should limit results to 50 items per page by default', () => {
      const sut = createLargeDataSet();

      const results = sut.search({ search: '[13579]' });

      expect(results.value.length).toBe(50);
    });

    it('should limit results to 1000 items per page max', () => {
      const sut = createLargeDataSet();

      const results = sut.search({ search: '[13579]', top: Number.MAX_SAFE_INTEGER });

      expect(results.value.length).toBe(1000);
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

      const results = sut.search({ count: true, search: 'b[ai]' });

      expect(results['@odata.count']).toBe(2);
    });

    it('should match total results length across all pages on large queries', () => {
      const sut = createLargeDataSet();

      const results = sut.search({ count: true, search: '[13579]' });

      expect(results['@odata.count']).toBe(1109);
    });
  });

  describe('next', () => {
    it('should not provide info for next page when empty', () => {
      const sut = createEmpty();

      const results = sut.search({});

      expect(results['@search.nextPageParameters']).toBe(undefined);
      expect(results['@odata.nextLink']).toBe(undefined);
    });

    it('should not provide info for next page when all results fit on a single page', () => {
      const sut = createBasic();

      const results = sut.search({ search: 'b[ai]' });

      expect(results['@search.nextPageParameters']).toBe(undefined);
      expect(results['@odata.nextLink']).toBe(undefined);
    });

    it('should provide info for next page when more than one page', () => {
      const sut = createLargeDataSet();

      const results = sut.search({ search: '[13579]', top: 1500 });

      expect(results['@search.nextPageParameters']).toEqual({ search: '[13579]', skip: 1000, top: 500 });
      expect(results['@odata.nextLink']).toBe('search=%5B13579%5D&%24skip=1000&%24top=500');
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
});