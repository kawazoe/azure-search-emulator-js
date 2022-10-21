import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import { pipe } from '../lib/functions';
import { filter, flatten, map, sortBy, take, toArray, toIterable } from '../lib/iterables';

import type { KeyFieldDefinition } from './schema';
import { SearchEngine} from './searchEngine';

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
    private searchEngine: SearchEngine<T>,
    private keyFieldProvider: () => KeyFieldDefinition,
    private suggesterProvider: (name: string) => Suggester,
  ) {
  }

  public suggest<Keys extends ODataSelect<T>>(request: SuggestRequest<T, Keys>): SuggestDocumentsResult<ODataSelectResult<T, Keys>> {
    const top = request.top && Math.min(request.top, maxPageSize) || defaultPageSize;

    const searchResults = this.searchEngine.search({
      filter: request.filter,
      highlight: request.searchFields ?? this.suggesterProvider(request.suggesterName).fields.join(', '),
      highlightPreTag: request.highlightPreTag ?? '',
      highlightPostTag: request.highlightPostTag ?? '',
      minimumCoverage: request.minimumCoverage ?? 80,
      orderBy: request.orderBy,
      search: request.search,
      searchFields: request.searchFields,
      select: request.select ?? [this.keyFieldProvider().name as Keys],
      top,
    });

    const coverage = (request.minimumCoverage ? { '@search.coverage': searchResults['@search.coverage'] } : {});
    const results = pipe(
      searchResults.value,
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

    return {
      ...coverage,
      value: results,
    };
  }
}