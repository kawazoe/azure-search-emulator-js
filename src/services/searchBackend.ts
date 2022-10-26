import { pipe } from '../lib/functions';
import {
  filter,
  flatten,
  map,
  reduce,
  sum,
  toArray,
  uniq
} from '../lib/iterables';
import { getValue } from '../lib/objects';
import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import * as Parsers from '../parsers';
import type { FieldDefinition, FlatSchema } from './schema';
import { SchemaService } from './schema';
import { normalizeValue } from './utils';

export interface SearchFacetBase {
  count: number;
}
export interface SearchFacetValue extends SearchFacetBase {
  value: unknown;
}
export interface SearchFacetRange extends SearchFacetBase {
  from: unknown;
  to: unknown;
}
export type SearchHighlights = Record<string, FieldDefinition['type'] | string[]>;
export interface SearchFeature {
  uniqueTokenMatches: number;
  similarityScore: number;
  termFrequency: number;
}
export type SearchFeatures = Record<string, SearchFeature>;
export interface SearchDocumentMeta {
  '@search.score'?: number;
  '@search.highlights': SearchHighlights;
  '@search.features': SearchFeatures;
}
export type SearchResult<T extends object> = SearchDocumentMeta & T;

const maxHighlightPadding = 30;

function toPaths(ast: Parsers.SelectAst | null) {
  return ast == null || ast.type === 'WILDCARD'
    ? []
    : ast.value.map(f =>
      Array.isArray(f.value)
        ? f.value.join('/')
        : f.value
    );
}

type Reducer<T extends object, Keys extends ODataSelect<T>> = (
  accumulator: {
    facets: Parsers.FacetResults,
    values: SearchResult<ODataSelectResult<T, Keys>>[]
  },
  current: {
    document: T,
    filterMatch: boolean,
    filterScore: number,
    searchMatch: boolean,
    searchScore: number,
    highlights: SearchHighlights,
    features: SearchFeatures
  }
) => { facets: Parsers.FacetResults, values: SearchResult<ODataSelectResult<T, Keys>>[] };

function createNothingReducer<T extends object, Keys extends ODataSelect<T>>(): Reducer<T, Keys> {
  return (acc) => acc;
}

function createDocumentFullReducer<T extends object, Keys extends ODataSelect<T>>(next: Reducer<T, Keys>): Reducer<T, Keys> {
  return (acc, cur) => {
    acc.values.push({
      ...cur.document as unknown as ODataSelectResult<T, Keys>,
      '@search.score': cur.filterScore + cur.searchScore,
      '@search.highlights': cur.highlights,
      '@search.features': cur.features,
    });

    return next(acc, cur);
  };
}
function createDocumentSelectedReducer<T extends object, Keys extends ODataSelect<T>>(selectCommand: Parsers.SelectParserResult, next: Reducer<T, Keys>): Reducer<T, Keys> {
  return (acc, cur) => {
    acc.values.push({
      ...selectCommand.apply(cur.document) as ODataSelectResult<T, Keys>,
      '@search.score': cur.filterScore + cur.searchScore,
      '@search.highlights': cur.highlights,
      '@search.features': cur.features,
    } as SearchResult<ODataSelectResult<T, Keys>>);

    return next(acc, cur);
  }
}

function createFacetReducer<T extends object, Keys extends ODataSelect<T>>(facetCommands: Parsers.FacetParserResult[], next: Reducer<T, Keys>): Reducer<T, Keys> {
  return (acc, cur) => {
    acc.facets = facetCommands.reduce((a, c) => c.apply(a, cur.document), acc.facets);

    return next(acc, cur);
  }
}

function createSearchScoreReducer<T extends object, Keys extends ODataSelect<T>>(
  search: string,
  searchableSchema: FlatSchema,
  searchFieldsCommand: Parsers.SelectParserResult | null,
  highlightCommand: Parsers.HighlighParserResult | null,
  highlightPreTag: string,
  highlightPostTag: string,
  next: Reducer<T, Keys>,
): Reducer<T, Keys> {
  const searchFieldPaths = toPaths(searchFieldsCommand);
  const searchables = searchFieldPaths.length > 0
    ? searchableSchema.filter(([n]) => searchFieldPaths.includes(n))
    : searchableSchema;

  const highlightPaths = toPaths(highlightCommand);
  const searchRegex = new RegExp(search, 'g');

  return (acc, cur) => {
    for (const [name, path, field] of searchables) {
      const value = getValue(cur.document, path);

      if (value == null) {
        continue;
      }

      const normalized = normalizeValue(value);
      const matches = pipe(
        normalized,
        map(str => str.matchAll(searchRegex)),
        flatten,
        // Ignore empty results
        filter(m => !!m[0]),
        // Ignore group results. Only look at the complete match
        map((m) => ({ match: m[0], index: m.index ?? 0, input: m.input ?? '' })),
        toArray,
      );

      if (matches.length > 0) {
        cur.searchScore += sum(matches.map(t => (1 - t.index / t.input.length) * t.match.length));

        const uniqueTokens = pipe(matches, uniq(m => m.match), toArray);
        const valueLength = sum(normalized.map(v => v.length));
        const matchedLength = sum(matches.map(t => t.match.length));

        if (highlightPaths.includes(name)) {
          cur.highlights[`${field.name}@odata.type`] = field.type;
          cur.highlights[field.name] = pipe(
            uniqueTokens,
            map(m => {
              const leftPadding = m.input.slice(Math.max(0, m.index - maxHighlightPadding), m.index);
              const rightPadding = m.input.slice(m.index + m.match.length, m.index + m.match.length + maxHighlightPadding);
              return `${leftPadding}${highlightPreTag}${m.match}${highlightPostTag}${rightPadding}`;
            }),
            toArray,
          );
        }

        cur.features[field.name] = {
          uniqueTokenMatches: uniqueTokens.length,
          similarityScore: valueLength === 0
            ? 0
            : (matchedLength / valueLength),
          termFrequency: matches.length,
        }
      }
    }

    cur.searchMatch = cur.searchScore > 0;

    if (!cur.searchMatch) {
      return acc;
    }

    return next(acc, cur);
  }
}

function createFilterScoreReducer<T extends object, Keys extends ODataSelect<T>>(filterCommand: Parsers.FilterParserResult, next: Reducer<T, Keys>): Reducer<T, Keys> {
  return (acc, cur) => {
    cur.filterScore = filterCommand.apply(cur.document);
    cur.filterMatch = cur.filterScore > 0;

    if (!cur.filterMatch) {
      return acc;
    }

    return next(acc, cur);
  }
}

export class SearchBackend<T extends object> {
  constructor(
    private readonly schemaService: SchemaService<T>,
    private readonly documentsProvider: () => Iterable<T>,
  ) {
  }

  public search<Keys extends ODataSelect<T>>(request: {
    search: string | null,
    highlightPreTag: string,
    highlightPostTag: string,
    filterCommand: Parsers.FilterParserResult | null,
    orderByCommand: Parsers.OrderByParserResult | null,
    selectCommand: Parsers.SelectParserResult | null,
    searchFieldsCommand: Parsers.SelectParserResult | null,
    highlightCommand: Parsers.HighlighParserResult | null,
    facetCommands: Parsers.FacetParserResult[] | null,
  }): { facets: Parsers.FacetResults, values: SearchResult<ODataSelectResult<T, Keys>>[] } {
    this.schemaService.assertCommands(request);

    let reducer: Reducer<T, Keys> = createNothingReducer();

    if (request.selectCommand) {
      reducer = createDocumentSelectedReducer(request.selectCommand, reducer);
    } else {
      reducer = createDocumentFullReducer(reducer);
    }

    if (request.facetCommands) {
      reducer = createFacetReducer(request.facetCommands, reducer);
    }

    if (request.search) {
      reducer = createSearchScoreReducer(request.search, this.schemaService.searchableSchema, request.searchFieldsCommand, request.highlightCommand, request.highlightPreTag, request.highlightPostTag, reducer);
    }

    if (request.filterCommand) {
      reducer = createFilterScoreReducer(request.filterCommand, reducer);
    }

    const results = pipe(
      this.documentsProvider(),
      map(document => ({ document, filterMatch: true, filterScore: 0, searchMatch: true, searchScore: 0, highlights: {}, features: {} })),
      reduce(reducer, { facets: {}, values: [] }),
    );

    if (request.orderByCommand) {
      results.values.sort(request.orderByCommand.apply);
    }

    return results;
  }
}
