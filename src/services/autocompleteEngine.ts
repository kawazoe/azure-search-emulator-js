import { DataStore } from './dataStore';

export interface AutoCompleteRequest {
  autocompleteMode?: 'oneTerm' | 'twoTerms' | 'oneTermWithContext';
  filter?: string;          //< OData Filter expression
  fuzzy?: boolean;
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  search?: string;          //< simple query expression
  searchFields?: string;    //< fields as ODataSelect
  top?: number;
}

export interface AutoCompleteResult {
  '@search.coverage'?: number;
  value: { text: string, queryPlusText: string }[];
}

export class AutocompleteEngine<T extends object> {
  // @ts-ignore
  constructor(private dataStore: DataStore<T>) {

  }

  // @ts-ignore
  public autocomplete(request: AutoCompleteRequest): AutoCompleteResult {
    // @ts-ignore
    return undefined;
  }
}