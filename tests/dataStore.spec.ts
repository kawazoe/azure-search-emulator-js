import { describe, expect, it } from 'vitest';

import { DataStore } from '../src';

import type { People } from './lib/mockSchema';
import { peopleAnalyzer, peopleSchemaService } from './lib/mockSchema';
import { makeGeoPoint } from '../src/lib/geo';

describe('DataStore', () => {
  describe('postDocuments', () => {
    describe('upload', () => {
      it('should add the document with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original' }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'original' },
          analyzed: expect.anything(),
        }]);
      })

      it('should replace the document with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original' }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'replaced' }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced' },
          analyzed: expect.anything(),
        }]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original' },
            { '@search.action': 'upload', id: 'abc', fullName: 'replaced' },
          ],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced' },
          analyzed: expect.anything(),
        }]);
      });
    });

    describe('merge', () => {
      it('should fail with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        const action = () => sut.postDocuments({
          value: [{ '@search.action': 'merge', id: 'abc', fullName: 'original' }],
        });

        expect(action).toThrowError(/404/);
      })

      it('should merge fields with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'merge', id: 'abc', fullName: 'replaced', ratio: 0.5 }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 },
          analyzed: expect.anything(),
        }]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 },
            { '@search.action': 'merge', id: 'abc', fullName: 'replaced', ratio: 0.5 },
          ],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 },
          analyzed: expect.anything(),
        }]);
      });
    });

    describe('mergeOrUpload', () => {
      it('should add the document with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [{ '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'original' }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'original' },
          analyzed: expect.anything(),
        }]);
      })

      it('should merge fields with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'replaced', ratio: 0.5 }],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 },
          analyzed: expect.anything(),
        }]);
      });

      it('should replace the document when batched with a reused key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [
            { '@search.action': 'upload', id: 'abc', fullName: 'original', income: 500 },
            { '@search.action': 'mergerOrUpload', id: 'abc', fullName: 'replaced', ratio: 0.5 },
          ],
        });

        expect(sut.documents).toEqual([{
          key: 'abc',
          original: { id: 'abc', fullName: 'replaced', income: 500, ratio: 0.5 },
          analyzed: expect.anything(),
        }]);
      });
    });

    describe('delete', () => {
      it('should fail with new key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

        sut.postDocuments({
          value: [{ '@search.action': 'upload', id: 'keep' }],
        });
        sut.postDocuments({
          value: [{ '@search.action': 'delete', id: 'abc' }],
        });

        expect(sut.documents).toEqual([{
          key: 'keep',
          original: {id: 'keep' },
          analyzed: expect.anything(),
        }]);
      });

      it('should remove the document with an existing key', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

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
          analyzed: expect.anything(),
        }]);
      });

      it('should remove the document with an existing key when batched', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

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
          analyzed: expect.anything(),
        }]);
      });
    });

    describe('parsing', () => {
      it('should parse incoming documents', () => {
        const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

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

        expect(sut.documents[0]).toEqual({
          key: 'abc',
          original: expect.anything(),
          analyzed: {
            id: {
              kind: 'fullText',
              values: ['abc'],
              normalized: ['abc'],
              entries: [[{ value: 'abc', index: 0, rindex: 3 }]],
              length: 3,
            },
            fullName: {
              kind: 'fullText',
              values: ["Mister Mac'Lown de Montreal, protector of (de) tests"],
              normalized: ["Mister Mac'Lown de Montreal, protector of (de) tests"],
              entries: [[
                {
                  value: "mister",
                  index: 0,
                  rindex: 6,
                },
                {
                  value: "mac",
                  index: 7,
                  rindex: 10,
                },
                {
                  value: "lown",
                  index: 11,
                  rindex: 15,
                },
                {
                  value: "de",
                  index: 16,
                  rindex: 18,
                },
                {
                  value: "montreal",
                  index: 19,
                  rindex: 27,
                },
                {
                  value: "protector",
                  index: 29,
                  rindex: 38,
                },
                {
                  value: "of",
                  index: 39,
                  rindex: 41,
                },
                {
                  value: "de",
                  index: 43,
                  rindex: 45,
                },
                {
                  value: "tests",
                  index: 47,
                  rindex: 52,
                },
              ]],
              length: 41,
            },
            income: {
              kind: 'fullText',
              values: [500],
              normalized: ['500'],
              entries: [[{ value: '500', index: 0, rindex: 3 }]],
              length: 3,
            },
            'addresses/kind': {
              kind: 'fullText',
              values: ['home', 'work'],
              normalized: ['home', 'work'],
              entries: [
                [{ value: 'home', index: 0, rindex: 4 }],
                [{ value: 'work', index: 0, rindex: 4 }]
              ],
              length: 8,
            },
            'addresses/location': {
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
    const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

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
      const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

      const action = () => sut.findDocument({ key: 'missing' });

      expect(action).toThrowError(/404/);
    });

    it('should return the document when matched', () => {
      const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

      sut.postDocuments({
        value: [{ '@search.action': 'upload', id: 'a', fullName: 'test', ratio: 0.5 }],
      });

      const result = sut.findDocument({ key: 'a' });

      expect(result).toEqual({ id: 'a', fullName: 'test', ratio: 0.5 });
    });

    it('should apply the select query', () => {
      const sut = new DataStore<People>(peopleSchemaService, peopleAnalyzer);

      sut.postDocuments({
        value: [{ '@search.action': 'upload', id: 'a', fullName: 'test', ratio: 0.5 }],
      });

      const result = sut.findDocument({ key: 'a', select: ['fullName'] });

      expect(result).toEqual({ fullName: 'test' });
    });
  });
});
