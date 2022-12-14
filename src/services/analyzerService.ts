import AsciiFolder from 'fold-to-ascii';

import type { GeoPoint } from '../lib/geo';
import { isGeoJsonPoint, isWKTPoint, makeGeoPointFromGeoJSON, makeGeoPointFromWKT } from '../lib/geo';
import { distribute } from '../lib/iterables';
import { _never } from '../lib/_never';
import { getValue } from '../lib/objects';
import { flatValue } from './utils';

import type { FilterableField, SearchableField } from './schema';
import { SchemaService } from './schema';
import * as Parsers from '../parsers';
import { SimpleActions } from '../parsers/query-simple';

import enStopwords from '../stopwords/en.json';
const defaultStopwords = enStopwords;

export type AnalyzerIdKeyword = 'keyword';
export type AnalyzerIdPattern = 'pattern';
export type AnalyzerIdSimple = 'simple';
export type AnalyzerIdStandard = 'standard' | 'standard.lucene';
export type AnalyzerIdStandardAsciiFoldingLucene = 'standardasciifolding.lucene';
export type AnalyzerIdStop = 'stop';
export type AnalyzerIdWhitespace = 'whitespace';

export type AnalyzerId =
    AnalyzerIdKeyword
  | AnalyzerIdPattern
  | AnalyzerIdSimple
  | AnalyzerIdStandard
  | AnalyzerIdStandardAsciiFoldingLucene
  | AnalyzerIdStop
  | AnalyzerIdWhitespace
  | string;

export interface NGram {
  value: string;
  index: number;
  rindex: number;
}
export interface AnalyzedValueFullText {
  kind: 'fullText';
  values: unknown[];
  normalized: string[];
  entries: NGram[][];
  length: number;
}

export interface AnalyzedValueGeo {
  kind: 'geo';
  values: unknown[];
  points: GeoPoint[];
}

export type AnalyzedValue = AnalyzedValueFullText | AnalyzedValueGeo;
export type AnalyzedDocument = Partial<Record<string, AnalyzedValue>>;

function toNGram(value: string, index: number): NGram {
  return { value, index, rindex: index + value.length };
}

export function createTokenizer(options: {
  splitter?: RegExp,
  normalizer?: (value: string) => string,
  filter?: (value: string) => boolean,
} = {}): (value: string) => NGram[] {
  return (value) => {
    if (!options.splitter) {
      return [toNGram(value, 0)];
    }

    const tokens = value.split(options.splitter);
    if (tokens.length === 0) {
      return [];
    }

    let index = 0;
    const results: NGram[] = [];
    for (const [token, separator] of distribute(tokens, 2)) {
      const ngram = toNGram(options.normalizer?.(token) ?? token, index);
      index += token.length + (separator?.length ?? 0);

      // String.split will always introduce an empty value if the string starts/ends with the separator.
      // Filtering need to be done after we generated all the indices.
      if (ngram.value && (options.filter?.(ngram.value) ?? true)) {
        results.push(ngram);
      }
    }

    return results;
  }
}

const simpleSeparatorRegex = /([^\p{L}\p{N}]+)/u;
// Uses separators instead of \W to better cover composite words.
const standardSeparatorRegex = /([\s.!?:;,()\[\]{}<>\/\\]+)/;
const whitespaceSeparatorRegex = /(\p{White_Space}+)/u;

export type AnalyzerFn = (value: string) => NGram[];

const analyzers: Record<AnalyzerId, AnalyzerFn> = {
  'keyword': createTokenizer(),
  'pattern': createTokenizer({
    splitter: simpleSeparatorRegex,
  }),
  'simple': createTokenizer({
    splitter: simpleSeparatorRegex,
    normalizer: v => v.toLowerCase(),
  }),
  // TODO: Implement lucene tokenizer
  'standard.lucene': createTokenizer({
    splitter: standardSeparatorRegex,
    normalizer: v => v.toLowerCase(),
    filter: v => !defaultStopwords.includes(v),
  }),
  'standard': value => analyzers['standard.lucene'](value),
  // TODO: Implement lucene tokenizer
  'standardasciifolding.lucene': createTokenizer({
    splitter: standardSeparatorRegex,
    normalizer: v => AsciiFolder.foldMaintaining(v).toLowerCase(),
    filter: v => !defaultStopwords.includes(v),
  }),
  'stop': createTokenizer({
    splitter: simpleSeparatorRegex,
    normalizer: v => v.toLowerCase(),
    filter: v => !defaultStopwords.includes(v),
  }),
  'whitespace': createTokenizer({
    splitter: whitespaceSeparatorRegex,
  }),
  // HACK: Since we do not support custom analyzers yet, we use the en analyzer as a case-sensitive variant to standard.
  'en.lucene': createTokenizer({
    splitter: standardSeparatorRegex,
    normalizer: v => AsciiFolder.foldMaintaining(v).toLowerCase(),
    filter: v => !enStopwords.includes(v),
  }),
  'ms.lucene': value => analyzers['en.lucene'](value),
};

export function score(entry: NGram[], match: NGram[]) {
  const entryLength = entry[entry.length - 1].rindex;
  const matchIndex = Math.min(match[0].index, entryLength);
  const matchLength = Math.min(match[match.length - 1].rindex, entryLength) - matchIndex;
  return (1 - matchIndex / entryLength) * matchLength;
}

export interface SimpleMatch {
  ngrams: NGram[];
  score: number;
}
export type SimpleMatches = SimpleMatch[];

type Matcher = (ngram: NGram, word: NGram, isLastWord: boolean) => { match: NGram; ngram: NGram } | null;
const equalsMatcher: Matcher = (ngram, word) => {
  return ngram.value === word.value
    ? { ngram, match: ngram }
    : null;
}
const startsWithMatcher: Matcher = (ngram, word, isLastWord) => {
  if (isLastWord) {
    return ngram.value.startsWith(word.value)
      ? {
        ngram,
        match: {
          value: word.value,
          index: ngram.index,
          rindex: ngram.index + word.value.length,
        },
      }
      : null;
  }

  return equalsMatcher(ngram, word, isLastWord);
}

export type MatchMode = 'equals' | 'startsWith';
function getMatcher(matchMode: MatchMode) {
  switch (matchMode) {
    case 'equals':
      return equalsMatcher;
    case 'startsWith':
      return startsWithMatcher;
    default:
      return _never(matchMode);
  }
}

function findSimpleMatches(query: NGram[], entry: NGram[], matcher: Matcher): SimpleMatches {
  if (query.length === 0 || entry.length === 0) {
    return [];
  }

  const matches: SimpleMatches = [];
  let match: { ngram: NGram, match: NGram }[] = [];

  for (const ngram of entry) {
    const word = query[match.length];
    const isLastWord = match.length >= query.length - 1;
    const m = matcher(ngram, word, isLastWord);
    if (m) {
      match.push(m);

      if (match.length >= query.length) {
        matches.push({
          ngrams: match.map(m => m.ngram),
          score: score(entry, match.map(m => m.match)),
        });

        match = [];
      }
    } else {
      match = [];
    }
  }

  return matches;
}

export type TermAnalyzisResult = {
  query: NGram[],
  apply: (entry: NGram[], matchMode: MatchMode) => SimpleMatches,
};
export type QueryAnalyzisResult = {
  query: NGram[],
  apply: (entry: NGram[]) => SimpleMatches,
};

export type SimpleSearchMode = 'any' | 'all';
function analyzeSimpleQuery(queryCommand: SimpleActions, analyzerId: AnalyzerId): QueryAnalyzisResult {
  const analyzer = analyzers[analyzerId];

  return queryCommand.analyze((query): TermAnalyzisResult => {
    const analyzed = analyzer(query);
    return {
      query: analyzed,
      apply: (entry, matchMode: MatchMode) => findSimpleMatches(analyzed, entry, getMatcher(matchMode)),
    };
  });
}

function keepLast<T>(source: T[]): T[] {
  if (source.length === 0) {
    return [];
  }

  return [source[source.length - 1]];
}

export type PlainAnalysisMode = 'oneTerm' | 'twoTerms' | 'oneTermWithContext';
function analyzePlainQuery(analyzerId: AnalyzerId, search: string, analysisMode: PlainAnalysisMode): QueryAnalyzisResult {
  const query = analyzers[analyzerId](search);

  const apply = (function () {
    switch (analysisMode) {
      case 'oneTerm':
      case 'twoTerms':
        return (entry: NGram[]) => findSimpleMatches(keepLast(query), entry, startsWithMatcher);
      case 'oneTermWithContext':
        return (entry: NGram[]) => findSimpleMatches(query, entry, startsWithMatcher);
      default:
        return _never(analysisMode);
    }
  })();

  return { query, apply };
}

export type QueryingStrategy = (field: SearchableField) => QueryAnalyzisResult;
export function createSimpleQueryStrategy(options: { search: string, searchMode: SimpleSearchMode }): QueryingStrategy {
  const queryCommand = Parsers.simple.parse(options.search, options.searchMode);

  return (field: SearchableField) => analyzeSimpleQuery(queryCommand, field.searchAnalyzer ?? field.analyzer ?? 'standard');
}
export function createPlainQueryStrategy(options: { search: string, analysisMode: PlainAnalysisMode }): QueryingStrategy {
  return (field: SearchableField) => analyzePlainQuery(field.searchAnalyzer ?? field.analyzer ?? 'standard', options.search, options.analysisMode);
}

function toPoint(value: unknown): GeoPoint | null {
  return isGeoJsonPoint(value)
    ? makeGeoPointFromGeoJSON(value)
    : isWKTPoint(value as string)
      ? makeGeoPointFromWKT(value as string)
      : null;
}

function analyzeValues(values: unknown[], analyzer: AnalyzerFn) {
  const normalized: string[] = [];
  const entries: NGram[][] = [];
  let length = 0;

  for (const v of values) {
    const normal = `${v}`;
    const entry = analyzer(normal);

    normalized.push(normal);
    entries.push(entry);

    for (const ngram of entry) {
      length += ngram.value.length;
    }
  }

  return {
    kind: 'fullText',
    values,
    normalized,
    entries,
    length,
  } as AnalyzedValueFullText;
}
function analyzeFullText(searchable: SearchableField, values: unknown[]) {
  const analyzerId = searchable.indexAnalyzer ?? searchable.analyzer ?? 'standard';
  const analyzer = analyzers[analyzerId];

  return analyzeValues(values, analyzer);
}

function analyzeBasic(field: SearchableField | FilterableField, values: unknown[]) {
  switch (field.type) {
    case 'Edm.String':
    case 'Edm.Int32':
    case 'Edm.Int64':
    case 'Edm.Double':
    case 'Edm.Boolean':
    case 'Edm.DateTimeOffset':
    case 'Collection(Edm.String)':
    case 'Collection(Edm.Int32)':
    case 'Collection(Edm.Int64)':
    case 'Collection(Edm.Double)':
    case 'Collection(Edm.Boolean)':
    case 'Collection(Edm.DateTimeOffset)': {
      return analyzeValues(values, analyzers['keyword']);
    }
    case 'Edm.GeographyPoint':
    case 'Collection(Edm.GeographyPoint)': {
      const points = values.map(toPoint).filter((p): p is GeoPoint => !!p);

      return {
        kind: 'geo',
        values,
        points,
      } as AnalyzedValueGeo;
    }
    default:
      return _never(field);
  }
}

export class AnalyzerService<T extends object> {
  constructor(
    private readonly schemaService: SchemaService<T>,
  ) {
  }

  public analyzeDocument(document: T): AnalyzedDocument {
    const flat = this.schemaService.analyzableSchema
      .map((entry) => {
        const value = getValue(document, entry.path);
        return ({ ...entry, values: flatValue(value) });
      })
      .filter(({ values }) => !!values?.find(v => !!v))
      .map(({ name, field, values, isFullText }) => [
        name,
        isFullText ? analyzeFullText(field, values) : analyzeBasic(field, values)
      ]);

    return Object.fromEntries(flat);
  }
}
