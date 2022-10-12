import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import { DataStore } from './dataStore';

export interface SuggestRequest<T extends object, Keys extends ODataSelect<T> | string> {
  filter?: string;          //< OData Filter expression
  fuzzy?: boolean;
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  orderBy?: string;         //< OrderBy Expression
  search?: string;          //< simple query expression
  searchFields?: string;    //< fields as ODataSelect
  select?: Keys[];          //< fields as ODataSelect
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

export class SuggestEngine<T extends object> {
  // @ts-ignore
  constructor(private dataStore: DataStore<T>) {

  }

  // @ts-ignore
  public suggest<Keys extends ODataSelect<T>>(request: SuggestRequest<T, Keys>): SuggestDocumentsResult<ODataSelectResult<T, Keys>> {
    // @ts-ignore
    return undefined;
  }
}