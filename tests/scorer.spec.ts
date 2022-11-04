import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScoringProfile, ScoringBases } from '../src';
import { Scorer } from '../src';

import type { People } from './lib/mockSchema';
import { addTime, subtractTime } from '../src/lib/dates';
import { makeGeoJsonPoint } from '../src/lib/geo';
import { peopleSchemaService } from './lib/mockSchema';

const profileDoubleFullName: ScoringProfile<People> = {
  name: 'doubleFullName',
  text: {
    weights: {
      fullName: 2,
    },
  }
};

describe('Scorer', () => {
  describe('profile selection', () => {
    it('should use the null strategy when no strategy is available', () => {
      const sut = new Scorer<People>([], null);

      const doc = peopleSchemaService.parseDocument({ id: '1' });
      const bases: ScoringBases<People> = [
        { key: 'id', score: 3 },
        { key: 'fullName', score: 2 },
      ];

      const strategies = sut.getScoringStrategies(null, null);

      expect(strategies(doc, bases)).toBe(5);
    });

    it('should use the null strategy when no strategy is applied', () => {
      const sut = new Scorer([profileDoubleFullName], null);

      const doc = peopleSchemaService.parseDocument({ id: '1' });
      const bases: ScoringBases<People> = [
        { key: 'id', score: 3 },
        { key: 'fullName', score: 2 },
      ];

      const strategies = sut.getScoringStrategies(null, null);

      expect(strategies(doc, bases)).toBe(5);
    });

    it('should use the default strategy as fallback', () => {
      const sut = new Scorer([profileDoubleFullName], 'doubleFullName');

      const doc = peopleSchemaService.parseDocument({ id: '1' });
      const bases: ScoringBases<People> = [
        { key: 'fullName', score: 2 },
      ];

      const strategies = sut.getScoringStrategies(null, null);

      expect(strategies(doc, bases)).toBe(4);
    });

    it('should use the requested strategy', () => {
      const sut = new Scorer([profileDoubleFullName], null);

      const doc = peopleSchemaService.parseDocument({ id: '1' });
      const bases: ScoringBases<People> = [
        { key: 'fullName', score: 2 },
      ];

      const strategies = sut.getScoringStrategies('doubleFullName', null);

      expect(strategies(doc, bases)).toBe(4);
    });
  });

  describe('scoring', () => {
    describe('text', () => {
      it('should multiply base by weight', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            text: {
              weights: {
                fullName: 2,
                'addresses/kind': 3.5,
                phones: 0.5,
              },
            },
          }],
          'default',
        );

        const doc = peopleSchemaService.parseDocument({
          id: '1',
          fullName: 'foo',
          addresses: [
            { kind: 'home' },
          ],
          phones: ['123'],
        });
        const bases: ScoringBases<People> = [
          { key: 'fullName', score: 3 },
          { key: 'addresses/kind', score: 4 },
          { key: 'phones', score: 0.3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        expect(strats(doc, bases)).toBe(20.15);
      });
    });

    describe('functions', () => {
      describe('magnitude', () => {
        it('should boost numbers by interpolated value', () => {
          const sut = new Scorer<People>(
            [{
              name: 'default',
              functions: [{
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 10,
                  boostingRangeEnd: 20,
                  constantBoostBeyondRange: true,
                }
              }]
            }],
            'default',
          );

          const far =     peopleSchemaService.parseDocument({ id: '1', ratio: 5 });
          const lowNear = peopleSchemaService.parseDocument({ id: '1', ratio: 9 });
          const low =     peopleSchemaService.parseDocument({ id: '1', ratio: 10 });
          const middle =  peopleSchemaService.parseDocument({ id: '1', ratio: 15 });
          const up =      peopleSchemaService.parseDocument({ id: '1', ratio: 20 });
          const upNear =  peopleSchemaService.parseDocument({ id: '1', ratio: 21 });

          const bases: ScoringBases<People> = [
            { key: 'ratio', score: 3 },
          ];

          const strats = sut.getScoringStrategies(null, null);

          expect(strats(far,     bases)).toBe(3);
          expect(strats(lowNear, bases)).toBe(3);
          expect(strats(low,     bases)).toBe(3);
          expect(strats(middle,  bases)).toBe(4.5);
          expect(strats(up,      bases)).toBe(6);
          expect(strats(upNear,  bases)).toBe(6);
        });

        it('should reset to start when beyond range', () => {
          const sut = new Scorer<People>(
            [{
              name: 'default',
              functions: [{
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 10,
                  boostingRangeEnd: 20,
                }
              }]
            }],
            'default',
          );

          const up =      peopleSchemaService.parseDocument({ id: '1', ratio: 20 });
          const upNear =  peopleSchemaService.parseDocument({ id: '1', ratio: 21 });

          const bases: ScoringBases<People> = [
            { key: 'ratio', score: 3 },
          ];

          const strats = sut.getScoringStrategies(null, null);

          expect(strats(up,      bases)).toBe(6);
          expect(strats(upNear,  bases)).toBe(3);
        });

        it('should boost numbers by inverted interpolated value ', () => {
          const sut = new Scorer<People>(
            [{
              name: 'default',
              functions: [{
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 20,
                  boostingRangeEnd: 10,
                  constantBoostBeyondRange: true,
                }
              }]
            }],
            'default',
          );

          const far =     peopleSchemaService.parseDocument({ id: '1', ratio: 5 });
          const lowNear = peopleSchemaService.parseDocument({ id: '1', ratio: 9 });
          const low =     peopleSchemaService.parseDocument({ id: '1', ratio: 10 });
          const middle =  peopleSchemaService.parseDocument({ id: '1', ratio: 15 });
          const up =      peopleSchemaService.parseDocument({ id: '1', ratio: 20 });
          const upNear =  peopleSchemaService.parseDocument({ id: '1', ratio: 21 });

          const bases: ScoringBases<People> = [
            { key: 'ratio', score: 3 },
          ];

          const strats = sut.getScoringStrategies(null, null);

          expect(strats(far,     bases)).toBe(6);
          expect(strats(lowNear, bases)).toBe(6);
          expect(strats(low,     bases)).toBe(6);
          expect(strats(middle,  bases)).toBe(4.5);
          expect(strats(up,      bases)).toBe(3);
          expect(strats(upNear,  bases)).toBe(3);
        });

        it('should reset to end when beyond range ', () => {
          const sut = new Scorer<People>(
            [{
              name: 'default',
              functions: [{
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 20,
                  boostingRangeEnd: 10,
                }
              }]
            }],
            'default',
          );

          const far =     peopleSchemaService.parseDocument({ id: '1', ratio: 5 });
          const lowNear = peopleSchemaService.parseDocument({ id: '1', ratio: 9 });
          const low =     peopleSchemaService.parseDocument({ id: '1', ratio: 10 });
          const middle =  peopleSchemaService.parseDocument({ id: '1', ratio: 15 });
          const up =      peopleSchemaService.parseDocument({ id: '1', ratio: 20 });
          const upNear =  peopleSchemaService.parseDocument({ id: '1', ratio: 21 });

          const bases: ScoringBases<People> = [
            { key: 'ratio', score: 3 },
          ];

          const strats = sut.getScoringStrategies(null, null);

          expect(strats(far,     bases)).toBe(3);
          expect(strats(lowNear, bases)).toBe(3);
          expect(strats(low,     bases)).toBe(6);
          expect(strats(middle,  bases)).toBe(4.5);
          expect(strats(up,      bases)).toBe(3);
          expect(strats(upNear,  bases)).toBe(3);
        });
      });

      describe('freshness', () => {
        let now = new Date();

        beforeEach(() => {
          vi.useFakeTimers({ now });
        });

        afterEach(() => {
          vi.useRealTimers();
        });

        it('should boost dates until now in a given duration', () => {
          const sut = new Scorer<People>(
            [{
              name: 'default',
              functions: [{
                type: 'freshness',
                fieldName: 'metadata/createdOn',
                boost: 2,
                freshness: {
                  boostingDuration: 'P1D',
                },
              }],
            }],
            'default',
          );

          const past =    peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: subtractTime(now, 2) } });
          const p1dt1s =  peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: subtractTime(now, 1, 0, 0, 1) } });
          const p1d =     peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: subtractTime(now, 1) } });
          const pt12h =   peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: subtractTime(now, 0, 12) } });
          const nowd =    peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: now } });
          const future =  peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: addTime(now, 0, 0, 0, 1) } });

          const bases: ScoringBases<People> = [
            { key: 'metadata/createdOn', score: 3 },
          ];

          const strats = sut.getScoringStrategies(null, null);

          expect(strats(past,   bases)).toBeCloseTo(3, 5);
          expect(strats(p1dt1s, bases)).toBeCloseTo(3, 5);
          expect(strats(p1d,    bases)).toBeCloseTo(3, 5);
          expect(strats(pt12h,  bases)).toBeCloseTo(4.5, 5);
          expect(strats(nowd,   bases)).toBeCloseTo(6, 5);
          expect(strats(future, bases)).toBeCloseTo(3, 5);
        });

        it('should boost dates after now in a given duration', () => {
          const sut = new Scorer<People>(
            [{
              name: 'default',
              functions: [{
                type: 'freshness',
                fieldName: 'metadata/createdOn',
                boost: 2,
                freshness: {
                  boostingDuration: '-P1D',
                },
              }],
            }],
            'default',
          );

          const pt12h =   peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: subtractTime(now, 0, 12) } });
          const nowd =    peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: now } });
          const npt12h =  peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: addTime(now, 0, 12) } });
          const np1d =    peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: addTime(now, 1) } });
          const np1dt1s = peopleSchemaService.parseDocument({ id: '1', metadata: { createdOn: addTime(now, 1, 0, 0, 1) } });

          const bases: ScoringBases<People> = [
            { key: 'metadata/createdOn', score: 3 },
          ];

          const strats = sut.getScoringStrategies(null, null);

          expect(strats(pt12h,   bases)).toBeCloseTo(3, 5);
          expect(strats(nowd,    bases)).toBeCloseTo(6, 5);
          expect(strats(npt12h,  bases)).toBeCloseTo(4.5, 5);
          expect(strats(np1d,    bases)).toBeCloseTo(3, 5);
          expect(strats(np1dt1s, bases)).toBeCloseTo(3, 5);
        });
      });

      describe('distance', () => {
        it('should boost locations closer to the reference point within a distance radius', () => {
          const sut = new Scorer<People>(
            [{
              name: 'default',
              functions: [{
                type: 'distance',
                fieldName: 'addresses/location',
                boost: 2,
                distance: {
                  referencePointParameter: 'rp',
                  boostingDistance: 100,
                }
              }],
            }],
            'default',
          );

          const far =       peopleSchemaService.parseDocument({ id: '1', addresses: [{location: makeGeoJsonPoint(-71.20688089878229, 46.80772501699039) }] });
          const d100k200m = peopleSchemaService.parseDocument({ id: '1', addresses: [{location: makeGeoJsonPoint(-72.55136962206396, 46.07725335123803) }] });
          const d100k =     peopleSchemaService.parseDocument({ id: '1', addresses: [{location: makeGeoJsonPoint(-72.55341125057537, 46.07613738135688) }] });
          const d50k =      peopleSchemaService.parseDocument({ id: '1', addresses: [{location: makeGeoJsonPoint(-73.05641549253124, 45.79361063088562) }] });
          const rp =        peopleSchemaService.parseDocument({ id: '1', addresses: [{location: makeGeoJsonPoint(-73.5543295037799, 45.50890239725307) }] });

          const bases: ScoringBases<People> = [
            { key: 'addresses/location', score: 3 },
          ];

          const strats = sut.getScoringStrategies(null, ['rp--73.5543295037799, 45.50890239725307']);

          expect(strats(far,       bases)).toBeCloseTo(3, 4);
          expect(strats(d100k200m, bases)).toBeCloseTo(3, 4);
          expect(strats(d100k,     bases)).toBeCloseTo(3, 4);
          expect(strats(d50k,      bases)).toBeCloseTo(4.5, 4);
          expect(strats(rp,        bases)).toBeCloseTo(6, 4);
        });
      });

      describe('tag', () => {
        it('should boost text as a larger proportion of the words are tags', () => {
          const sut = new Scorer<People>(
            [{
              name: 'default',
              functions: [{
                type: 'tag',
                fieldName: 'fullName',
                boost: 2,
                tag: {
                  tagsParameter: 't',
                }
              }],
            }],
            'default',
          );

          const mock =         peopleSchemaService.parseDocument({ id: '1', fullName: 'mock' });
          const mockfoo =      peopleSchemaService.parseDocument({ id: '1', fullName: 'mockfoo' });
          const mock_foo =     peopleSchemaService.parseDocument({ id: '1', fullName: 'mock foo' });
          const mock_foobar =  peopleSchemaService.parseDocument({ id: '1', fullName: 'mock foobar' });
          const mock_foo_bar = peopleSchemaService.parseDocument({ id: '1', fullName: 'mock foo bar' });
          const foo_bar =      peopleSchemaService.parseDocument({ id: '1', fullName: 'foo bar' });

          const bases: ScoringBases<People> = [
            { key: 'fullName', score: 3 },
          ];

          const strats = sut.getScoringStrategies(null, ["t-foo,bar"]);

          expect(strats(mock,         bases)).toBeCloseTo(3, 4);
          expect(strats(mockfoo,      bases)).toBeCloseTo(3, 4);
          expect(strats(mock_foo,     bases)).toBeCloseTo(4.5, 4);
          expect(strats(mock_foobar,  bases)).toBeCloseTo(3, 4);
          expect(strats(mock_foo_bar, bases)).toBeCloseTo(5, 4);
          expect(strats(foo_bar,      bases)).toBeCloseTo(6, 4);
        });
      });
    });

    describe('interpolation', () => {
      it('should be linear by default', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [{
              type: 'magnitude',
              fieldName: 'ratio',
              boost: 2,
              magnitude: {
                boostingRangeStart: 10,
                boostingRangeEnd: 20,
              }
            }]
          }],
          'default',
        );

        const start =  peopleSchemaService.parseDocument({ id: '1', ratio: 10 });
        const middle = peopleSchemaService.parseDocument({ id: '1', ratio: 15 });
        const end =    peopleSchemaService.parseDocument({ id: '1', ratio: 20 });

        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        expect(strats(start,  bases)).toBe(3);
        expect(strats(middle, bases)).toBe(4.5);
        expect(strats(end,    bases)).toBe(6);
      });

      it('should get max boost right away with constant', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [{
              type: 'magnitude',
              fieldName: 'ratio',
              boost: 2,
              magnitude: {
                boostingRangeStart: 10,
                boostingRangeEnd: 20,
              },
              interpolation: 'constant',
            }]
          }],
          'default',
        );

        const before = peopleSchemaService.parseDocument({ id: '1', ratio: 9 });
        const start =  peopleSchemaService.parseDocument({ id: '1', ratio: 10 });
        const end =    peopleSchemaService.parseDocument({ id: '1', ratio: 20 });
        const after =  peopleSchemaService.parseDocument({ id: '1', ratio: 21 });

        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        expect(strats(before, bases)).toBe(3);
        expect(strats(start,  bases)).toBe(6);
        expect(strats(end,    bases)).toBe(6);
        expect(strats(after,  bases)).toBe(3);
      });

      it('should get half boost half way with linear', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [{
              type: 'magnitude',
              fieldName: 'ratio',
              boost: 2,
              magnitude: {
                boostingRangeStart: 10,
                boostingRangeEnd: 20,
              },
              interpolation: 'linear',
            }]
          }],
          'default',
        );

        const middle = peopleSchemaService.parseDocument({ id: '1', ratio: 15 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        expect(strats(middle, bases)).toBe(4.5);
      });

      it('should get over half boost half way with quadratic', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [{
              type: 'magnitude',
              fieldName: 'ratio',
              boost: 2,
              magnitude: {
                boostingRangeStart: 10,
                boostingRangeEnd: 20,
              },
              interpolation: 'quadratic',
            }]
          }],
          'default',
        );

        const middle = peopleSchemaService.parseDocument({ id: '1', ratio: 15 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        expect(strats(middle, bases)).toBe(5.25);
      });

      it('should get under half boost half way with logarithmic', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [{
              type: 'magnitude',
              fieldName: 'ratio',
              boost: 2,
              magnitude: {
                boostingRangeStart: 10,
                boostingRangeEnd: 20,
              },
              interpolation: 'logarithmic',
            }]
          }],
          'default',
        );

        const middle = peopleSchemaService.parseDocument({ id: '1', ratio: 15 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        expect(strats(middle, bases)).toBe(3.75);
      });
    });

    describe('aggregation', () => {
      it('should sum by default', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 10,
                  boostingRangeEnd: 20,
                },
              },
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 3,
                magnitude: {
                  boostingRangeStart: 0,
                  boostingRangeEnd: 15,
                },
              },
            ],
          }],
          'default',
        );

        const doc = peopleSchemaService.parseDocument({ id: '1', ratio: 12 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        const fn2 = 7.8;
        expect(strats(doc, bases)).toBeCloseTo(fn1 + fn2, 5);
      });

      it('should sum individual function results', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 10,
                  boostingRangeEnd: 20,
                },
              },
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 3,
                magnitude: {
                  boostingRangeStart: 0,
                  boostingRangeEnd: 15,
                },
              },
            ],
            functionAggregation: 'sum',
          }],
          'default',
        );

        const doc = peopleSchemaService.parseDocument({ id: '1', ratio: 12 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        const fn2 = 7.8;
        expect(strats(doc, bases)).toBeCloseTo(fn1 + fn2, 5);
      });

      it('should average individual function results', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 10,
                  boostingRangeEnd: 20,
                },
              },
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 3,
                magnitude: {
                  boostingRangeStart: 0,
                  boostingRangeEnd: 15,
                },
              },
            ],
            functionAggregation: 'average',
          }],
          'default',
        );

        const doc = peopleSchemaService.parseDocument({ id: '1', ratio: 12 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        const fn2 = 7.8;
        expect(strats(doc, bases)).toBeCloseTo((fn1 + fn2) / 2, 5);
      });

      it('should take the minimum function result', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 10,
                  boostingRangeEnd: 20,
                },
              },
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 3,
                magnitude: {
                  boostingRangeStart: 0,
                  boostingRangeEnd: 15,
                },
              },
            ],
            functionAggregation: 'minimum',
          }],
          'default',
        );

        const doc = peopleSchemaService.parseDocument({ id: '1', ratio: 12 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        // const fn2 = 7.8;
        expect(strats(doc, bases)).toBeCloseTo(fn1, 5);
      });

      it('should take the maximum function result', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 10,
                  boostingRangeEnd: 20,
                },
              },
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 3,
                magnitude: {
                  boostingRangeStart: 0,
                  boostingRangeEnd: 15,
                },
              },
            ],
            functionAggregation: 'maximum',
          }],
          'default',
        );

        const doc = peopleSchemaService.parseDocument({ id: '1', ratio: 12 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        // const fn1 = 3.6;
        const fn2 = 7.8;
        expect(strats(doc, bases)).toBeCloseTo(fn2, 5);
      });

      it('should take the first function result', () => {
        const sut = new Scorer<People>(
          [{
            name: 'default',
            functions: [
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 2,
                magnitude: {
                  boostingRangeStart: 10,
                  boostingRangeEnd: 20,
                },
              },
              {
                type: 'magnitude',
                fieldName: 'ratio',
                boost: 3,
                magnitude: {
                  boostingRangeStart: 0,
                  boostingRangeEnd: 15,
                },
              },
            ],
            functionAggregation: 'firstMatching',
          }],
          'default',
        );

        const doc = peopleSchemaService.parseDocument({ id: '1', ratio: 12 });
        const bases: ScoringBases<People> = [
          { key: 'ratio', score: 3 },
        ];

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        // const fn2 = 7.8;
        expect(strats(doc, bases)).toBeCloseTo(fn1, 5);
      });
    });
  });
});