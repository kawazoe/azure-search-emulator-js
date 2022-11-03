import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScoringProfile } from '../src';
import { Scorer } from '../src';

import type { People } from './lib/mockSchema';
import { addTime, subtractTime } from '../src/lib/dates';
import { makeGeoJsonPoint } from '../src/lib/geoPoints';

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
      const sut = new Scorer([], null);

      const strategies = sut.getScoringStrategies(null, null);

      expect(strategies).toEqual({});
    });

    it('should use the null strategy when no strategy is applied', () => {
      const sut = new Scorer([profileDoubleFullName], null);

      const strategies = sut.getScoringStrategies(null, null);

      expect(strategies).toEqual({});
    });

    it('should use the default strategy as fallback', () => {
      const sut = new Scorer([profileDoubleFullName], 'doubleFullName');

      const strategies = sut.getScoringStrategies(null, null);

      expect(strategies).toEqual({ fullName: expect.any(Function) });
    });

    it('should use the requested strategy', () => {
      const sut = new Scorer([profileDoubleFullName], null);

      const strategies = sut.getScoringStrategies('doubleFullName', null);

      expect(strategies).toEqual({ fullName: expect.any(Function) });
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

        const strats = sut.getScoringStrategies(null, null);

        expect(strats.fullName?.('foo', 3)).toBe(6);
        expect(strats['addresses/kind']?.('home', 4)).toBe(14);
        expect(strats.phones?.('123', 0.3)).toBe(0.15);
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

          const strats = sut.getScoringStrategies(null, null);

          expect(strats.ratio?.(5, 3)).toBe(3);
          expect(strats.ratio?.(9, 3)).toBe(3);
          expect(strats.ratio?.(10, 3)).toBe(3);
          expect(strats.ratio?.(15, 3)).toBe(4.5);
          expect(strats.ratio?.(20, 3)).toBe(6);
          expect(strats.ratio?.(21, 3)).toBe(6);
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

          const strats = sut.getScoringStrategies(null, null);

          expect(strats.ratio?.(20, 3)).toBe(6);
          expect(strats.ratio?.(21, 3)).toBe(3);
        });

        it('should boost numbers by interpolated value ', () => {
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

          const strats = sut.getScoringStrategies(null, null);

          expect(strats.ratio?.(5, 3)).toBe(6);
          expect(strats.ratio?.(9, 3)).toBe(6);
          expect(strats.ratio?.(10, 3)).toBe(6);
          expect(strats.ratio?.(15, 3)).toBe(4.5);
          expect(strats.ratio?.(20, 3)).toBe(3);
          expect(strats.ratio?.(21, 3)).toBe(3);
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

          const strats = sut.getScoringStrategies(null, null);

          expect(strats.ratio?.(5, 3)).toBe(3);
          expect(strats.ratio?.(9, 3)).toBe(3);
          expect(strats.ratio?.(10, 3)).toBe(6);
          expect(strats.ratio?.(15, 3)).toBe(4.5);
          expect(strats.ratio?.(20, 3)).toBe(3);
          expect(strats.ratio?.(21, 3)).toBe(3);
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

          const past =    subtractTime(now, 2);
          const p1dt1s =  subtractTime(now, 1, 0, 0, 1);
          const p1d =     subtractTime(now, 1);
          const pt12h =   subtractTime(now, 0, 12);
          const future =  addTime(now, 0, 0, 0, 1);

          const strats = sut.getScoringStrategies(null, null);

          expect(strats['metadata/createdOn']?.(past,   3)).toBeCloseTo(3, 5);
          expect(strats['metadata/createdOn']?.(p1dt1s, 3)).toBeCloseTo(3, 5);
          expect(strats['metadata/createdOn']?.(p1d,    3)).toBeCloseTo(3, 5);
          expect(strats['metadata/createdOn']?.(pt12h,  3)).toBeCloseTo(4.5, 5);
          expect(strats['metadata/createdOn']?.(now,    3)).toBeCloseTo(6, 5);
          expect(strats['metadata/createdOn']?.(future, 3)).toBeCloseTo(3, 5);
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

          const pt12h =   subtractTime(now, 0, 12);
          const npt12h =  addTime(now, 0, 12);
          const np1d =    addTime(now, 1);
          const np1dt1s = addTime(now, 1, 0, 0, 1);

          const strats = sut.getScoringStrategies(null, null);

          expect(strats['metadata/createdOn']?.(pt12h,   3)).toBeCloseTo(3, 5);
          expect(strats['metadata/createdOn']?.(now,     3)).toBeCloseTo(6, 5);
          expect(strats['metadata/createdOn']?.(npt12h,  3)).toBeCloseTo(4.5, 5);
          expect(strats['metadata/createdOn']?.(np1d,    3)).toBeCloseTo(3, 5);
          expect(strats['metadata/createdOn']?.(np1dt1s, 3)).toBeCloseTo(3, 5);
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

          const far = makeGeoJsonPoint(46.80772501699039, -71.20688089878229);
          const d100k200m = makeGeoJsonPoint(46.07725335123803, -72.55136962206396);
          const d100k = makeGeoJsonPoint(46.07613738135688, -72.55341125057537);
          const d50k = makeGeoJsonPoint(45.79361107476408, -73.05641103879233);
          const rp = makeGeoJsonPoint(45.50890239725307, -73.5543295037799);

          const strats = sut.getScoringStrategies(null, ['rp-45.50890239725307, -73.5543295037799']);

          expect(strats['addresses/location']?.(far, 3)).toBeCloseTo(3, 4);
          expect(strats['addresses/location']?.(d100k200m, 3)).toBeCloseTo(3, 4);
          expect(strats['addresses/location']?.(d100k, 3)).toBeCloseTo(3, 4);
          expect(strats['addresses/location']?.(d50k, 3)).toBeCloseTo(4.5, 4);
          expect(strats['addresses/location']?.(rp, 3)).toBeCloseTo(6, 4);
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

          const strats = sut.getScoringStrategies(null, ["t-foo,bar"]);

          expect(strats.fullName?.('mock', 3)).toBeCloseTo(3, 4);
          expect(strats.fullName?.('mockfoo', 3)).toBeCloseTo(3, 4);
          expect(strats.fullName?.('mock foo', 3)).toBeCloseTo(4.5, 4);
          expect(strats.fullName?.('mock foobar', 3)).toBeCloseTo(3, 4);
          expect(strats.fullName?.('mock foo bar', 3)).toBeCloseTo(5, 4);
          expect(strats.fullName?.('foo bar', 3)).toBeCloseTo(6, 4);
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

        const strats = sut.getScoringStrategies(null, null);

        expect(strats.ratio?.(10, 3)).toBe(3);
        expect(strats.ratio?.(15, 3)).toBe(4.5);
        expect(strats.ratio?.(20, 3)).toBe(6);
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

        const strats = sut.getScoringStrategies(null, null);

        expect(strats.ratio?.(9, 3)).toBe(3);
        expect(strats.ratio?.(10, 3)).toBe(6);
        expect(strats.ratio?.(20, 3)).toBe(6);
        expect(strats.ratio?.(21, 3)).toBe(3);
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

        const strats = sut.getScoringStrategies(null, null);

        expect(strats.ratio?.(15, 3)).toBe(4.5);
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

        const strats = sut.getScoringStrategies(null, null);

        expect(strats.ratio?.(15, 3)).toBe(5.25);
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

        const strats = sut.getScoringStrategies(null, null);

        expect(strats.ratio?.(15, 3)).toBe(3.75);
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

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        const fn2 = 7.8;
        expect(strats.ratio?.(12, 3)).toBeCloseTo(fn1 + fn2, 5);
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

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        const fn2 = 7.8;
        expect(strats.ratio?.(12, 3)).toBeCloseTo(fn1 + fn2, 5);
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

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        const fn2 = 7.8;
        expect(strats.ratio?.(12, 3)).toBeCloseTo((fn1 + fn2) / 2, 5);
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

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        // const fn2 = 7.8;
        expect(strats.ratio?.(12, 3)).toBeCloseTo(fn1, 5);
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

        const strats = sut.getScoringStrategies(null, null);

        // const fn1 = 3.6;
        const fn2 = 7.8;
        expect(strats.ratio?.(12, 3)).toBeCloseTo(fn2, 5);
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

        const strats = sut.getScoringStrategies(null, null);

        const fn1 = 3.6;
        // const fn2 = 7.8;
        expect(strats.ratio?.(12, 3)).toBeCloseTo(fn1, 5);
      });
    });
  });
});