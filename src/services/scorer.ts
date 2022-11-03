import { _never } from '../lib/_never';
import { average, groupBy, join, max, min, sum } from '../lib/iterables';
import { _throw } from '../lib/_throw';
import { addTime, subtractTime } from '../lib/dates';
import { calculateDistance, GeoJSONPoint, makeGeoPoint } from '../lib/geoPoints';
import { DeepKeyOf } from '../lib/odata';

export interface ScoringFnIdentity<T extends object> {
  fieldName: DeepKeyOf<T, '/'>;
}
export interface ScoringFnApplication {
  boost: number;
  interpolation?: 'constant' | 'linear' | 'quadratic' | 'logarithmic';
}

export interface ScoringMagnitudeFn extends ScoringFnApplication {
  type: 'magnitude';
  magnitude: {
    boostingRangeStart: number;
    boostingRangeEnd: number;
    constantBoostBeyondRange?: boolean;
  };
}
export interface ScoringFreshnessFn extends ScoringFnApplication {
  type: 'freshness';
  freshness: {
    boostingDuration: string;
  };
}
export interface ScoringDistanceFn extends ScoringFnApplication {
  type: 'distance';
  distance: {
    referencePointParameter: string;
    boostingDistance: number;
  };
}
export interface ScoringTagFn extends ScoringFnApplication {
  type: 'tag';
  tag: {
    tagsParameter: string;
  }
}
export type ScoringFn = ScoringMagnitudeFn | ScoringFreshnessFn | ScoringDistanceFn | ScoringTagFn;
export type IdentifiedScoringFn<T extends object> = ScoringFnIdentity<T> & ScoringFn;

export interface ScoringProfile<T extends object> {
  name: string;
  text?: {
    weights: Partial<Record<DeepKeyOf<T, '/'>, number>>;
  };
  functions?: IdentifiedScoringFn<T>[];
  functionAggregation?: 'sum' | 'average' | 'minimum' | 'maximum' | 'firstMatching';
}

export type ScoringParams = Record<string, string[]>;
export type ScoringStrategy = (value: any, base: number) => number;
export type RawScoringStrategy = (params: ScoringParams) => (value: any, base: number) => number;
export type ScoringStrategies<T extends object> = Partial<Record<DeepKeyOf<T, '/'>, ScoringStrategy>>;
export type RawScoringStrategies<T extends object> = [DeepKeyOf<T, '/'>, RawScoringStrategy][];

const nullStrategy: RawScoringStrategy = () => (_, base) => base;

type InterpolationFn = (value: any, lower: any, upper: any) => number;

const constantInterpolation: InterpolationFn = (value, lower, upper) => value < lower ? 0 : value > upper ? 0 : 1;
const linearInterpolation: InterpolationFn = (value, lower, upper) => {
  if (lower === upper) {
    return 0;
  }
  return (value - lower) / (upper - lower);
};
const quadraticInterpolation: InterpolationFn = (value, lower, upper) => {
  const v = linearInterpolation(value, lower, upper);
  return -(v ** 2) + (2 * v);
};
const logarithmicInterpolation: InterpolationFn = (value, lower, upper) => {
  return linearInterpolation(value, lower, upper) ** 2;
};

function toInterpolationFn(fn: ScoringFnApplication, latch: boolean): InterpolationFn {
  const limit = <T>(value: T, lower: T, upper: T) => lower < upper
    ? limitL(value, lower, upper, latch)
    : limitU(value, upper, lower, latch);

  switch (fn.interpolation) {
    case 'constant':
      return constantInterpolation;
    case undefined:
    case 'linear':
      return (value, lower, upper) => linearInterpolation(limit(value, lower, upper), lower, upper);
    case 'quadratic':
      return (value, lower, upper) => quadraticInterpolation(limit(value, lower, upper), lower, upper);
    case 'logarithmic':
      return (value, lower, upper) => logarithmicInterpolation(limit(value, lower, upper), lower, upper);
    default:
      return _never(fn.interpolation);
  }
}

function limitL<T>(value: T, lower: T, upper: T, latch: boolean): T {
  if (value < lower) {
    return lower;
  }
  if (value > upper) {
    return latch ? upper : lower;
  }
  return value;
}
function limitU<T>(value: T, lower: T, upper: T, latch: boolean): T {
  if (value < lower) {
    return latch ? lower : upper;
  }
  if (value > upper) {
    return upper;
  }
  return value;
}
function boostScore<T>(
  value: T,
  lower: T,
  upper: T,
  base: number,
  interpolate: InterpolationFn,
  factor: number,
): number {
  return base + base * interpolate(value, lower, upper) * (factor - 1);
}

function magnitudeFunctionStrategy(fn: ScoringMagnitudeFn): RawScoringStrategy {
  const { boostingRangeStart, boostingRangeEnd, constantBoostBeyondRange } = fn.magnitude;
  const interpolate = toInterpolationFn(fn, constantBoostBeyondRange ?? false);

  return () => (value: number, base) => boostScore(value, boostingRangeStart, boostingRangeEnd, base, interpolate, fn.boost);
}

const xsdDayTimeDurationRegex = /(?<neg>-)?P((?<days>\d+)D)?(T((?<hours>\d+)H)?((?<minutes>\d+)M)?((?<seconds>\d+(\.\d+)?)S)?)?/;
function freshnessFunctionStrategy(fn: ScoringFreshnessFn): RawScoringStrategy {
  const boostingDurationMatch = fn.freshness.boostingDuration.match(xsdDayTimeDurationRegex);
  const interpolate = toInterpolationFn(fn, false);

  if (!boostingDurationMatch?.groups) {
    throw new Error(`Invalid boostingDuration of ${fn.freshness.boostingDuration}`);
  }

  const boostingDuration = {
    neg: !!boostingDurationMatch.groups.neg,
    days: parseInt(boostingDurationMatch.groups.days ?? 0),
    hours: parseInt(boostingDurationMatch.groups.hours ?? 0),
    minutes: parseInt(boostingDurationMatch.groups.minutes ?? 0),
    seconds: parseInt(boostingDurationMatch.groups.seconds ?? 0),
  };
  const boostingDurationWindow = (now: Date) => boostingDuration.neg
    ? addTime(now, boostingDuration.days, boostingDuration.hours, boostingDuration.minutes, boostingDuration.seconds)
    : subtractTime(now, boostingDuration.days, boostingDuration.hours, boostingDuration.minutes, boostingDuration.seconds);

  return () => {
    const now = new Date();
    const window = boostingDurationWindow(now);

    return (value: Date, base) => boostScore(value, window, now, base, interpolate, fn.boost);
  };
}

function distanceFunctionStrategy(fn: ScoringDistanceFn): RawScoringStrategy {
  const interpolate = toInterpolationFn(fn, true);

  return (params) => {
    const referencePoint = params[fn.distance.referencePointParameter] ?? _throw(new Error(`Missing referencePointParameter with name of ${fn.distance.referencePointParameter} in query`));
    const to = makeGeoPoint(parseFloat(referencePoint[0]), parseFloat(referencePoint[1]));

    return (value: GeoJSONPoint, base) => {
      const from = makeGeoPoint(value.coordinates[0], value.coordinates[1]);
      const distance = calculateDistance(from, to) / 1000;

      return boostScore(distance, fn.distance.boostingDistance, 0, base, interpolate, fn.boost);
    };
  };
}

function tagFunctionStrategy(fn: ScoringTagFn): RawScoringStrategy {
  // Uses separators instead of \w to better cover extended alphabets.
  const wordsRegex = /[^\s.!?:;,()\[\]{}<>\/\\]+/g;
  const interpolate = toInterpolationFn(fn, true);

  return (params) => {
    const tags = params[fn.tag.tagsParameter] ?? _throw(new Error(`Missing tagsParameter with name of ${fn.tag.tagsParameter} in query`));

    return (value: string, base) => {
      const words = Array.from(value.matchAll(wordsRegex)).flatMap(m => Array.from(m));
      const tagMatches = words.filter(w => tags.includes(w));

      return boostScore(tagMatches.length, 0, words.length, base, interpolate, fn.boost);
    };
  };
}

function toFunctionStrategy(fn: ScoringFn): RawScoringStrategy {
  switch (fn.type) {
    case 'magnitude':
      return magnitudeFunctionStrategy(fn);
    case 'freshness':
      return freshnessFunctionStrategy(fn);
    case 'distance':
      return distanceFunctionStrategy(fn);
    case 'tag':
      return tagFunctionStrategy(fn);
    default:
      return _never(fn);
  }
}

function aggregateStrategies<T extends object>(
  algorithm: ScoringProfile<T>['functionAggregation'],
  strategies: RawScoringStrategy[]
): RawScoringStrategy {
  switch (algorithm) {
    case undefined:
    case 'sum':
      return (params) => (value, base) => sum(strategies.map(s => s(params)(value, base)));
    case 'average':
      return (params) => (value, base) => average(strategies.map(s => s(params)(value, base)));
    case 'minimum':
      return (params) => (value, base) => min(strategies.map(s => s(params)(value, base)));
    case 'maximum':
      return (params) => (value, base) => max(strategies.map(s => s(params)(value, base)));
    case 'firstMatching':
      return strategies[0];
    default:
      _never(algorithm);
  }
}

function toStrategies<T extends object>(profile: ScoringProfile<T>): RawScoringStrategies<T> {
  const weightByFields: [string, number][] = Object.entries(profile.text?.weights ?? {});
  const functionsByFields = groupBy(profile.functions ?? [], v => v.fieldName);

  const fields: [string, { weight: number, functions: ScoringFn[] }][] = join(
    weightByFields,
    functionsByFields,
      w => w[0],
      f => f.key,
    (w, f) => [
      w?.[0] ?? f?.key ?? '',
      { weight: w?.[1] ?? 1, functions: f?.results ?? [] },
    ] as [string, { weight: number, functions: ScoringFn[] }],
  );

  return fields.map(
    (cur) => {
      const weightStrategy: RawScoringStrategy = () => (_, base) => base * cur[1].weight;
      const aggregatedFunctionStrategy = aggregateStrategies(
        profile.functionAggregation,
        cur[1].functions.map(toFunctionStrategy)
      );

      if (cur[1].weight !== 1 && cur[1].functions.length === 0) {
        return [cur[0], weightStrategy];
      } else if (cur[1].weight === 1 && cur[1].functions.length === 0) {
        return [cur[0], nullStrategy];
      } else if (cur[1].weight !== 1 && cur[1].functions.length !== 0) {
        return [cur[0], (params) => (value, base) => aggregatedFunctionStrategy(params)(value, weightStrategy(params)(value, base))];
      } else if (cur[1].weight === 1 && cur[1].functions.length !== 0) {
        return [cur[0], aggregatedFunctionStrategy];
      }

      return _never(cur as never);
    }
  ) as RawScoringStrategies<T>;
}

function parseParams(params: string[] | null): ScoringParams {
  if (!params || params.length === 0) {
    return {};
  }

  const parsed = params.map(param => {
    const stack: string[] = [''];

    let inArgs = false;
    let inQuotes = false;

    for (let i = 0; i < param.length; i++) {
      const charCur = param[i];
      const charNext = param[i+1];

      // digraphs
      if (charCur === parseParams.argQuote && charNext !== parseParams.argQuote) {
        inQuotes = !inQuotes;
        continue;
      }

      // graphs
      if (charCur === parseParams.fnSeparator && !inArgs) {
        stack.unshift('');
        inArgs = true;
        continue;
      }
      if (charCur === parseParams.argSeparator && ! inQuotes) {
        stack.unshift('');
        continue;
      }

      stack[0] += charCur;
    }

    stack.reverse();
    const [fn, ...args] = stack;

    if (!fn) {
      throw new Error('Invalid function name');
    }

    return [fn, args];
  });

  return Object.fromEntries(parsed);
}
parseParams.fnSeparator = '-';
parseParams.argSeparator = ',';
parseParams.argQuote = "'";

function applyParams<T extends object>(strategies: RawScoringStrategies<T>, params: ScoringParams): ScoringStrategies<T> {
  return Object.fromEntries(strategies.map(([k, s]) => [k, s(params)])) as ScoringStrategies<T>;
}

export class Scorer<T extends object> {
  public strategies: Record<string, RawScoringStrategies<T>>;
  public defaultStrategy: RawScoringStrategies<T> | null;

  constructor(
    readonly profiles: ScoringProfile<T>[],
    readonly defaultProfile: string | null,
  ) {
    this.strategies = Object.fromEntries(profiles.map(p => [p.name, toStrategies(p)]));
    this.defaultStrategy = defaultProfile && this.strategies[defaultProfile] || null;
  }

  public getScoringStrategies(profile: string | null, parameters: string[] | null ): ScoringStrategies<T> {
    const params = parseParams(parameters);
    const strategies = (profile && this.strategies[profile]) || this.defaultStrategy || [];
    return applyParams<T>(strategies, params);
  }
}
