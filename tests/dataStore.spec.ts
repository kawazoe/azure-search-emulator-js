import { describe, expect, it } from 'vitest';

import { DataStore } from '../src';

import type { People } from './lib/mockSchema';
import { hydrateParsedProxies, peopleSchemaService } from './lib/mockSchema';
import { makeGeoPoint } from '../src/lib/geo';

describe('DataStore', () => {
  describe('postDocuments', () => {
    describe('upload', () => {
      it('should add the document with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original' }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'original' },
          parsed: expect.anything(),
        }]);
      })

      it('should replace the document with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original' }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'replaced' }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced' },
          parsed: expect.anything(),
        }]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original' },
            { '@search.action': 'upload', id: 'abc', fullName: 'replaced' },
          ],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced' },
          parsed: expect.anything(),
        }]);
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

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 },
          parsed: expect.anything(),
        }]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 },
            { '@search.action': 'merge', id: 'abc', fullName: 'replaced', ratio: 0.5 },
          ],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 },
          parsed: expect.anything(),
        }]);
      });
    });

    describe('mergeOrUpload', () => {
      it('should add the document with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'original' }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'original' },
          parsed: expect.anything(),
        }]);
      })

      it('should merge fields with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'replaced', ratio: 0.5 }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 },
          parsed: expect.anything(),
        }]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 },
            { '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'replaced', ratio: 0.5 },
          ],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 },
          parsed: expect.anything(),
        }]);
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

        expect(sut.documents).toEqual([{
          key: 'keep',
          original: {id: 'keep' },
          parsed: expect.anything(),
        }]);
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

        expect(sut.documents).toEqual([{
          key: 'keep',
          original: {id: 'keep' },
          parsed: expect.anything(),
        }]);
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

        expect(sut.documents).toEqual([{
          key: 'keep',
          original: {id: 'keep' },
          parsed: expect.anything(),
        }]);
      });
    });

    describe('parsing', () => {
      it('should parse incoming documents', () => {
        const sut = new DataStore<People>(peopleSchemaService);

        sut.postDocuments({
          value: [{
            '@search.action': 'upload',
            id: 'abc',
            fullName: "Mister Mac'Lown de Montreal, protector of (de) tests",
            income: 500,
            addresses: [
              { kind: 'home', location: { type: 'Point', coordinates: [1, 2] } },
              { kind: 'work', location: 'POINT (3 4)' },
            ]
          }],
        });

        const document = sut.documents[0];

        hydrateParsedProxies(document.parsed);

        console.log(document)

        expect(document).toEqual({
          key: 'abc',
          original: expect.anything(),
          parsed: {
            id: {
              type: 'Edm.String',
              kind: 'text',
              values: ['abc'],
              normalized: ['abc'],
              words: [['abc']],
            },
            fullName: {
              type: 'Edm.String',
              kind: 'text',
              values: ["Mister Mac'Lown de Montreal, protector of (de) tests"],
              normalized: ["Mister Mac'Lown de Montreal, protector of (de) tests"],
              words: [['Mister', "Mac'Lown", 'de', 'Montreal', 'protector', 'of', 'de', 'tests']]
            },
            income: {
              type: 'Edm.Int64',
              kind: 'generic',
              values: [500],
              normalized: ['500']
            },
            addresses: {
              type: 'Collection(Edm.ComplexType)',
              kind: 'raw',
              values: [
                { kind: 'home', location: { type: 'Point', coordinates: [1, 2] } },
                { kind: 'work', location: 'POINT (3 4)' },
              ],
            },
            'addresses/kind': {
              type: 'Edm.String',
              kind: 'text',
              values: ['home', 'work'],
              normalized: ['home', 'work'],
              words: [['home'], ['work']],
            },
            'addresses/location': {
              type: 'Edm.GeographyPoint',
              kind: 'geo',
              values: [{ type: 'Point', coordinates: [1, 2] }, 'POINT (3 4)'],
              points: [
                makeGeoPoint(1, 2),
                makeGeoPoint(3, 4),
              ],
            },
          },
        });
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
