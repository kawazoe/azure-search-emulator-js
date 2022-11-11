import AsciiFolder from 'fold-to-ascii';
import stopwords from 'stopwords-json/dist/en.json';

import type { GeoPoint } from '../lib/geo';
import { isGeoJsonPoint, isWKTPoint, makeGeoPointFromGeoJSON, makeGeoPointFromWKT } from '../lib/geo';
import type { DeepKeyOf } from '../lib/types';
import { _throw } from '../lib/_throw';
import { sum } from '../lib/iterables';
import { _never } from '../lib/_never';
import { getValue } from '../lib/objects';
import { flatValue } from './utils';

import type {
  EdmCollection,
  EdmComplexType,
  EdmGeographyPoint,
  EdmString,
  FieldDefinition,
  FlatSchema
} from './schema';

export type AnalyzerIdKeyword = 'keyword';
export type AnalyzerIdPattern = 'pattern';
export type AnalyzerIdSimple = 'simple';
export type AnalyzerIdStandard = 'standard' | 'standard.lucene';
export type AnalyzerIdStandardAsciiFoldingLucene = 'standardasciifolding.lucene';
export type AnalyzerIdStop = 'stop';
export type AnalyzerIdWhitespace = 'whitespace';

export type AnalyzerId =
  AnalyzerIdKeyword |
  AnalyzerIdPattern |
  AnalyzerIdSimple |
  AnalyzerIdStandard |
  AnalyzerIdStandardAsciiFoldingLucene |
  AnalyzerIdStop |
  AnalyzerIdWhitespace |
  string;

export interface ParsedValueRaw {
  type: EdmComplexType | EdmCollection<EdmComplexType>;
  kind: 'raw';
  values: unknown[];
}

export interface ParsedValueText {
  type: EdmString | EdmCollection<EdmString>;
  kind: 'text';
  values: unknown[];
  normalized: string[];
  tokens: string[][];
  length: number;
  searchAnalyzer: AnalyzerId;
  indexAnalyzer: AnalyzerId;
}

export interface ParsedValueGeo {
  type: EdmGeographyPoint | EdmCollection<EdmGeographyPoint>;
  kind: 'geo';
  values: unknown[];
  points: GeoPoint[];
}

export interface ParsedValueGeneric {
  type: Exclude<FieldDefinition['type'], ParsedValueRaw['type'] | ParsedValueText['type'] | ParsedValueGeo['type']>;
  kind: 'generic';
  values: unknown[];
  normalized: string[];
  tokens: string[][];
  length: number;
}

export type ParsedValue = ParsedValueRaw | ParsedValueText | ParsedValueGeo | ParsedValueGeneric;
export type ParsedDocument<T extends object> = Partial<Record<DeepKeyOf<T>, ParsedValue>>;

function toPoint(value: unknown): GeoPoint | null {
  return isGeoJsonPoint(value)
    ? makeGeoPointFromGeoJSON(value)
    : isWKTPoint(value as string)
      ? makeGeoPointFromWKT(value as string)
      : null;
}

const simpleSeparatorRegex = /\W+/;
// Uses separators instead of \W to better cover composite words.
const standardSeparatorRegex = /[\s.!?:;,()\[\]{}<>\/\\]+/;
const whitespaceSeparatorRegex = /\p{White_Space}/u;

function tokenize(value: string, indexAnalyzer: AnalyzerId): string[] {
  switch (indexAnalyzer) {
    case 'keyword':
      return [value];
    case 'pattern':
      return value
        .split(simpleSeparatorRegex);
    case 'simple':
      return value
        .split(simpleSeparatorRegex)
        .map(t => t.toLowerCase());
    case 'standard':
    case 'standard.lucene':
      // TODO: Implement lucene tokenizer
      return value
        .split(standardSeparatorRegex)
        .map(t => t.toLowerCase())
        .filter(t => !stopwords.includes(t));
    case 'standardasciifolding.lucene':
      // TODO: Implement lucene tokenizer
      return value
        .split(standardSeparatorRegex)
        .map(t => t.toLowerCase())
        .filter(t => !stopwords.includes(t))
        .map(t => AsciiFolder.foldMaintaining(t));
    case 'stop':
      return value
        .split(simpleSeparatorRegex)
        .map(t => t.toLowerCase())
        .filter(t => !stopwords.includes(t));
    case 'whitespace':
      return value
        .split(whitespaceSeparatorRegex);
    case 'en.microsoft':
    case 'en.lucene':
      // HACK: Since we do not support custom analyzers yet, we use the en analyzer as a case-sensitive variant to standard.
      return value
        .split(standardSeparatorRegex)
        .filter(t => !stopwords.includes(t))
        .map(t => AsciiFolder.foldMaintaining(t));
    default:
      return _throw(new Error(`Unsupported analyzer: ${indexAnalyzer}`));
  }
}

export function createParseDocument<T extends object>(schema: FlatSchema<T>): (document: T) => ParsedDocument<T> {
  const getNormalized = (target: ParsedValueText | ParsedValueGeneric) =>
    target.values.map(v => `${v}`);
  const getTokens = (normalized: string[] | undefined, indexAnalyzer: AnalyzerId) => () =>
    normalized?.map(s => tokenize(s, indexAnalyzer));
  const getLength = (tokens: string[][] | undefined) => () =>
    sum(tokens?.flatMap(ts => ts.flatMap(t => t.length)) ?? []);
  const getPoints = (target: ParsedValueGeo) =>
    target.values.map(toPoint).filter((p): p is GeoPoint => !!p);

  function getOrDefault<T extends object, K extends keyof T, V extends T[K]>(target: T, key: K, fn: (target: T) => V | undefined) {
    if (key in target) {
      return target[key];
    }
    const value = fn(target);
    target[key] = value as V; //< force writing undefined so that we do not recreate the value everytime.
    return value;
  }

  function createParsedValueTarget(field: FieldDefinition, values: unknown[]) {
    switch (field.type) {
      case 'Edm.String':
      case 'Collection(Edm.String)':
        return {
          type: field.type,
          kind: 'text',
          values,
          searchAnalyzer: field.searchAnalyzer ?? field.analyzer ?? 'standard',
          indexAnalyzer: field.indexAnalyzer ?? field.analyzer ?? 'standard',
        } as ParsedValueText;
      case 'Edm.Int32':
      case 'Edm.Int64':
      case 'Edm.Double':
      case 'Edm.Boolean':
      case 'Edm.DateTimeOffset':
      case 'Collection(Edm.Int32)':
      case 'Collection(Edm.Int64)':
      case 'Collection(Edm.Double)':
      case 'Collection(Edm.Boolean)':
      case 'Collection(Edm.DateTimeOffset)':
        return {
          type: field.type,
          kind: 'generic',
          values,
        } as ParsedValueGeneric;
      case 'Edm.ComplexType':
      case 'Collection(Edm.ComplexType)':
        return {
          type: field.type,
          kind: 'raw',
          values,
        } as ParsedValueRaw;
      case 'Edm.GeographyPoint':
      case 'Collection(Edm.GeographyPoint)':
        return {
          type: field.type,
          kind: 'geo',
          values,
        } as ParsedValueGeo;
      default:
        return _never(field);
    }
  }

  function createParsedValueProxy(proxied: ParsedValue) {
    switch (proxied.kind) {
      case 'raw':
        return new Proxy(proxied, {
          get(target, p): any {
            switch (p) {
              case 'type':
                return target.type;
              case 'kind':
                return target.kind;
              case 'values':
                return target.values;
              default:
                return undefined;
            }
          }
        });
      case 'text':
        return new Proxy(proxied, {
          get(target, p, receiver: ParsedValueText): any {
            switch (p) {
              case 'type':
                return target.type;
              case 'kind':
                return target.kind;
              case 'values':
                return target.values;
              case 'searchAnalyzer':
                return target.searchAnalyzer;
              case 'indexAnalyzer':
                return target.indexAnalyzer;
              case 'normalized':
                return getOrDefault(target, 'normalized', getNormalized);
              case 'tokens':
                return getOrDefault(target, 'tokens', getTokens(receiver.normalized, target.indexAnalyzer));
              case 'length':
                return getOrDefault(target, 'length', getLength(receiver.tokens));
              default:
                return undefined;
            }
          }
        });
      case 'generic':
        return new Proxy(proxied, {
          get(target, p, receiver: ParsedValueGeneric): any {
            switch (p) {
              case 'type':
                return target.type;
              case 'kind':
                return target.kind;
              case 'values':
                return target.values;
              case 'normalized':
                return getOrDefault(target, 'normalized', getNormalized);
              case 'tokens':
                return getOrDefault(target, 'tokens', getTokens(receiver.normalized, 'keyword'));
              case 'length':
                return getOrDefault(target, 'length', getLength(receiver.tokens));
              default:
                return undefined;
            }
          }
        });
      case 'geo':
        return new Proxy(proxied, {
          get(target, p): any {
            switch (p) {
              case 'type':
                return target.type;
              case 'kind':
                return target.kind;
              case 'values':
                return target.values;
              case 'points':
                return getOrDefault(target, 'points', getPoints);
              default:
                return undefined;
            }
          }
        });
      default:
        return _never(proxied);
    }
  }

  return (document: T) => {
    const flat = schema
      .map(({key, path, field}) => {
        const value = getValue(document, path);
        return ({ key, field, values: flatValue(value) });
      })
      .filter(({ values }) => !!values?.find(v => !!v))
      .map(({ key, field, values }) => [key, createParsedValueProxy(createParsedValueTarget(field, values))]);

    return Object.fromEntries(flat);
  };
}