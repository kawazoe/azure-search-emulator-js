import { describe, expect, it } from 'vitest';

import { DataStore } from '../src';

import type { People } from './lib/mockSchema';
import { peopleSchemaService } from './lib/mockSchema';

describe('DataStore', () => {
  describe('postDocuments', () => {
    describe('upload', () => {
      it('should add the document with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original' }],
        });

        expect(sut.documents).toEqual([{id: 'abc', fullName: 'original'}]);
      })

      it('should replace the document with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original' }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'replaced' }],
        });

        expect(sut.documents).toEqual([{id: 'abc', fullName: 'replaced'}]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original' },
            { '@search.action': 'upload', id: 'abc', fullName: 'replaced' },
          ],
        });

        expect(sut.documents).toEqual([{id: 'abc', fullName: 'replaced'}]);
      });
    });

    describe('merge', () => {
      it('should fail with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        const action = () => sut.postDocuments({
          value: [{ '@search.action': 'merge', id: 'abc', fullName: 'original' }],
        });

        expect(action).toThrowError(/404/);
      })

      it('should merge fields with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'merge', id: 'abc', fullName: 'replaced', ratio: 0.5 }],
        });

        expect(sut.documents).toEqual([{id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 }]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 },
            { '@search.action': 'merge', id: 'abc', fullName: 'replaced', ratio: 0.5 },
          ],
        });

        expect(sut.documents).toEqual([{id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5}]);
      });
    });

    describe('mergeOrUpload', () => {
      it('should add the document with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'original' }],
        });

        expect(sut.documents).toEqual([{id: 'abc', fullName: 'original'}]);
      })

      it('should merge fields with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'replaced', ratio: 0.5 }],
        });

        expect(sut.documents).toEqual([{id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 }]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 },
            { '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'replaced', ratio: 0.5 },
          ],
        });

        expect(sut.documents).toEqual([{id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5}]);
      });
    });

    describe('delete', () => {
      it('should fail with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'keep' }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'delete', id: 'abc' }],
        });

        expect(sut.documents).toEqual([{id: 'keep' }]);
      });

      it('should remove the document with an existing key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'keep' },
            { '@search.action': 'upload', id: 'abc' },
          ],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'delete', id: 'abc' }],
        });

        expect(sut.documents).toEqual([{id: 'keep' }]);
      });

      it('should remove the document with an existing key when batched', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'keep' },
            { '@search.action': 'upload', id: 'abc' },
            { '@search.action': 'delete', id: 'abc' },
          ],
        });

        expect(sut.documents).toEqual([{id: 'keep' }]);
      });
    });
  });

  it('countDocuments', () => {
    const sut = new DataStore<People>(peopleSchemaService);

    sut.postDocuments({
      value: [
        { '@search.action': 'upload', id: 'a' },
        { '@search.action': 'upload', id: 'b' },
        { '@search.action': 'delete', id: 'a' },
        { '@search.action': 'upload', id: 'c' },
      ],
    });

    expect(sut.countDocuments()).toBe(2);
  });

  describe('findDocument', () => {
    it('should fail if the document is missing', () => {
      const sut = new DataStore<People>(peopleSchemaService);

      const action = () => sut.findDocument({ key: 'missing' });

      expect(action).toThrowError(/404/);
    });

    it('should return the document when matched', () => {
      const sut = new DataStore<People>(peopleSchemaService);

      sut.postDocuments({
        value: [{ '@search.action': 'upload', id: 'a', fullName: 'test', ratio: 0.5 }],
      });

      const result = sut.findDocument({ key: 'a' });

      expect(result).toEqual({ id: 'a', fullName: 'test', ratio: 0.5 });
    });

    it('should apply the select query', () => {
      const sut = new DataStore<People>(peopleSchemaService);

      sut.postDocuments({
        value: [{ '@search.action': 'upload', id: 'a', fullName: 'test', ratio: 0.5 }],
      });

      const result = sut.findDocument({ key: 'a', select: ['fullName'] });

      expect(result).toEqual({ fullName: 'test' });
    });
  });
});
