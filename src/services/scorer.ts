import { _never } from '../lib/_never';
import { average, max, min, sum } from '../lib/iterables';
import { _throw } from '../lib/_throw';
import { addTime, subtractTime } from '../lib/dates';
import { calculateDistance, makeGeoPoint } from '../lib/geo';
import { DeepKeyOf } from '../lib/odata';
import type { ParsedDocument, ParsedValue, ParsedValueGeo, ParsedValueText } from './schema';

export interface ScoringFnIdentity<T extends object> {
  fieldName: DeepKeyOf<T>;
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
    weights: Partial<Record<DeepKeyOf<T>, number>>;
  };
  functions?: IdentifiedScoringFn<T>[];
  functionAggregation?: 'sum' | 'average' | 'minimum' | 'maximum' | 'firstMatching';
}

export type ScoringParams = Record<string, string[]>;
export type ScoringBases<T extends object> = { key: DeepKeyOf<T>, score: number }[];

export type ScoringStrategy = (value: ParsedValue) => number;
export type ScoringStrategies<T extends object> = (document: ParsedDocument<T>, bases: ScoringBases<T>) => number;

export type RawScoringStrategy = (params: ScoringParams) => ScoringStrategy;
export type RawScoringStrategies<T extends object> = (params: ScoringParams) => ScoringStrategies<T>;

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

function createBooster<T>(interpolate: InterpolationFn, factor: number): (value: T, lower: T, upper: T) => number {
  return (v, l, u) => 1 + interpolate(v, l, u) * (factor - 1)
}

function magnitudeFunctionStrategy(fn: ScoringMagnitudeFn): RawScoringStrategy {
  const { boostingRangeStart, boostingRangeEnd, constantBoostBeyondRange } = fn.magnitude;
  const boost = createBooster(toInterpolationFn(fn, constantBoostBeyondRange ?? false), fn.boost);

  return () => (value: ParsedValue) => sum(value.values.map(v => boost(
    v as number,
    boostingRangeStart,
    boostingRangeEnd,
  )));
}

const xsdDayTimeDurationRegex = /(?<neg>-)?P((?<days>\d+)D)?(T((?<hours>\d+)H)?((?<minutes>\d+)M)?((?<seconds>\d+(\.\d+)?)S)?)?/;
function freshnessFunctionStrategy(fn: ScoringFreshnessFn): RawScoringStrategy {
  const boostingDurationMatch = fn.freshness.boostingDuration.match(xsdDayTimeDurationRegex);
  const boost = createBooster(toInterpolationFn(fn, false), fn.boost);

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

    return (value: ParsedValue) => sum(value.values.map(v => boost(
      v as Date,
      window,
      now,
    )));
  };
}

function distanceFunctionStrategy(fn: ScoringDistanceFn): RawScoringStrategy {
  const boost = createBooster(toInterpolationFn(fn, true), fn.boost);

  return (params) => {
    const referencePoint = params[fn.distance.referencePointParameter] ?? _throw(new Error(`Missing referencePointParameter with name of ${fn.distance.referencePointParameter} in query`));
    const to = makeGeoPoint(parseFloat(referencePoint[0]), parseFloat(referencePoint[1]));

    return (value: ParsedValue) => sum((value as ParsedValueGeo).points.map(from => boost(
      calculateDistance(from, to) / 1000,
      fn.distance.boostingDistance,
      0,
    )));
  };
}

function tagFunctionStrategy(fn: ScoringTagFn): RawScoringStrategy {
  const boost = createBooster(toInterpolationFn(fn, true), fn.boost);

  return (params) => {
    const tags = params[fn.tag.tagsParameter] ?? _throw(new Error(`Missing tagsParameter with name of ${fn.tag.tagsParameter} in query`));

    return (value: ParsedValue) => sum((value as ParsedValueText).words.map(words =>
      boost(
        words.filter(w => tags.includes(w)).length,
        0,
        words.length,
      )));
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

type AggregateStrategy = (boosts: number[]) => number;
function aggregateStrategies<T extends object>(
  algorithm: ScoringProfile<T>['functionAggregation']
): AggregateStrategy {
  switch (algorithm) {
    case undefined:
    case 'sum':
      return sum;
    case 'average':
      return average;
    case 'minimum':
      return min;
    case 'maximum':
      return max;
    case 'firstMatching':
      return (boosts) => boosts.find(b => b !== 1) ?? 1;
    default:
      _never(algorithm);
  }
}

function toStrategies<T extends object>(profile: ScoringProfile<T>): RawScoringStrategies<T> {
  const weightByFields: Partial<Record<DeepKeyOf<T>, number>>  = profile.text?.weights
    ?? {};
  const rawFunctionStrategies = profile.functions
    ?.map(fn => ({ key: fn.fieldName, strategy: toFunctionStrategy(fn) }))
    ?? [];
  const aggregateStrategy = aggregateStrategies(profile.functionAggregation);

  return (params) => {
    const functionStrategies = rawFunctionStrategies.map(fn => ({ key: fn.key, strategy: fn.strategy(params) }));

    return (document, bases) => {
      let score = 0;
      for (const base of bases) {
        const key = base.key as DeepKeyOf<T>;
        score += base.score * (weightByFields[key] ?? 1);
      }

      const boosts = functionStrategies
        .map(fn => ({ value: document[fn.key], strategy: fn.strategy }))
        .filter((fn): fn is { value: NonNullable<typeof fn.value>, strategy: typeof fn.strategy } => fn.value != null)
        .map(fn => fn.strategy(fn.value))
        ?? [];

      if (boosts.length === 0) {
        return score;
      }

      return score * aggregateStrategy(boosts);
    };
  };
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

const nullStrategy: ScoringStrategies<any> = (_, bases) => sum(bases.map(b => b.score));
export class Scorer<T extends object> {
  public strategies: Record<string, RawScoringStrategies<T>>;
  public defaultStrategy: RawScoringStrategies<T> | null;

  public static readonly nullStrategy = nullStrategy;

  constructor(
    readonly profiles: ScoringProfile<T>[],
    readonly defaultProfile: string | null,
  ) {
    this.strategies = Object.fromEntries(profiles.map(p => [p.name, toStrategies(p)]));
    this.defaultStrategy = defaultProfile && this.strategies[defaultProfile] || null;
  }

  public getScoringStrategies(profile: string | null, parameters: string[] | null ): ScoringStrategies<T> {
    const strategies = profile
      ? this.strategies[profile]
      : this.defaultStrategy;

    return strategies?.(parseParams(parameters)) ?? nullStrategy;
  }
}
