import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import { pipe } from '../lib/functions';
import { filter, flatten, map, sortBy, take, toArray, toIterable } from '../lib/iterables';

import type { KeyFieldDefinition } from './schema';
import { SearchBackend } from './searchBackend';
import * as Parsers from '../parsers';

export interface SuggestRequest<T extends object, Keys extends ODataSelect<T> | string> {
  filter?: string;          //< OData Filter expression
  fuzzy?: boolean;          //< Not supported
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  orderBy?: string;         //< OrderBy Expression
  search: string;           //< simple query expression
  searchFields?: string;    //< fields as ODataSelect
  select?: Keys[];          //< fields as ODataSelect
  suggesterName: string;
  top?: number;
}

export interface SuggestDocumentMeta {
  '@search.text': string;
}
export type SuggestResult<T extends object> = SuggestDocumentMeta & T;
export interface SuggestDocumentsResult<T extends object> {
  '@search.coverage'?: number;
  value: SuggestResult<T>[];
}

export interface Suggester {
  name: string;
  searchMode: 'analyzingInfixMatching';
  fields: string[];
}

const defaultPageSize = 5;
const maxPageSize = 100;

export class SuggestEngine<T extends object> {
  constructor(
    private backend: SearchBackend<T>,
    private keyFieldProvider: () => KeyFieldDefinition,
    private suggesterProvider: (name: string) => Suggester,
  ) {
  }

  public suggest<Keys extends ODataSelect<T>>(request: SuggestRequest<T, Keys>): SuggestDocumentsResult<ODataSelectResult<T, Keys>> {
    const select = request.select ?? [this.keyFieldProvider().name as Keys];
    const highlight = request.searchFields ?? this.suggesterProvider(request.suggesterName).fields.join(', ');
    const top = request.top && Math.min(request.top, maxPageSize) || defaultPageSize;

    const filterCommand = request.filter && Parsers.filter.parse(request.filter) || null;
    const orderByCommand = Parsers.orderBy.parse(request.orderBy ?? 'search.score() desc');
    const selectCommand = select && Parsers.select.parse(select.join(', ')) || null;
    const searchFieldsCommand = request.searchFields && Parsers.search.parse(request.searchFields) || null;
    const highlightCommand = highlight && Parsers.highlight.parse(highlight) || null;

    const searchResults = this.backend.search({
      search: request.search,
      highlightPreTag: request.highlightPreTag ?? '',
      highlightPostTag: request.highlightPostTag ?? '',
      filterCommand,
      orderByCommand,
      selectCommand,
      searchFieldsCommand,
      highlightCommand,
      facetCommands: null,
    });

    const results = pipe(
      searchResults.values,
      map(({
        ['@search.score']: score,
        ['@search.highlights']: highlights,
        ['@search.features']: features,
        ...rest
      }) => pipe(
        toIterable(highlights),
        filter(([k]) => !k.endsWith('@odata.type')),
        sortBy(([k]) => features[k].similarityScore, sortBy.desc),
        map(([,highlight]) => pipe(
          highlight,
          map((v) => ({
            '@search.text': v,
            ...rest,
          } as unknown as SuggestResult<ODataSelectResult<T, Keys>>)),
        )),
        flatten,
      )),
      flatten,
      take(top),
      toArray,
    );

    const coverage = request.minimumCoverage ? 100 : null;

    return {
      ...(coverage == null ? {} : { '@search.coverage': coverage}),
      value: results,
    };
  }
}