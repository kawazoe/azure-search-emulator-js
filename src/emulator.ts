import { _throw } from './lib/_throw';

import { FieldDefinition } from './services/schema';
import { DataStore, FindDocumentRequest, PostDocumentsRequest } from './services/dataStore';
import { createHttp404 } from './lib/http';
import { SearchDocumentsPageResult, SearchDocumentsRequest, SearchEngine } from './services/searchEngine';
import { ODataSelect, ODataSelectResult } from './lib/odata';
import { SuggestDocumentsResult, SuggestEngine, SuggestRequest } from './services/suggestEngine';
import { AutocompleteEngine, AutoCompleteRequest, AutoCompleteResult } from './services/autocompleteEngine';

export class Index<T extends object> {
  public static createIndex<T extends object>(
    name: string,
    schema: FieldDefinition[]
  ) {

    const dataStore = DataStore.createDataStore<T>(schema);

    return new Index<T>(
      name,
      dataStore,
      new SearchEngine<T>(dataStore),
      new SuggestEngine<T>(dataStore),
      new AutocompleteEngine<T>(dataStore),
    );
  }

  private constructor(
    public readonly name: string,
    private dataStore: DataStore<T>,
    private searchEngine: SearchEngine<T>,
    private suggestEngine: SuggestEngine<T>,
    private autocompleteEngine: AutocompleteEngine<T>,
  ) {
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/addupdate-or-delete-documents
   * @param documents
   */
  public postDocuments(documents: PostDocumentsRequest<T>) {
    return this.dataStore.postDocuments(documents);
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/lookup-document
   * @param request
   */
  public findDocument(request: FindDocumentRequest) {
    return this.dataStore.findDocument(request);
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/count-documents
   */
  public countDocuments(): number {
    return this.dataStore.countDocuments();
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/search-documents
   * @param request
   */
  public search<Keys extends ODataSelect<T>>(request: SearchDocumentsRequest<T, Keys>): SearchDocumentsPageResult<ODataSelectResult<T, Keys>> {
    return this.searchEngine.search(request);
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/autocomplete
   * @param request
   */
  public autocomplete(request: AutoCompleteRequest): AutoCompleteResult {
    return this.autocompleteEngine.autocomplete(request);
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/suggestions
   * @param request
   */
  public suggest<Keys extends ODataSelect<T>>(request: SuggestRequest<T, Keys>): SuggestDocumentsResult<ODataSelectResult<T, Keys>> {
    return this.suggestEngine.suggest(request);
  }
}

export class Emulator {
  private indices: Index<{}>[] = [];

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/create-index
   */
  public createIndex(name: string, schema: FieldDefinition[]) {
    this.indices.push(Index.createIndex(name, schema));
  }

  public getIndex<T extends {}>(name: string): Index<T> {
    return this.indices.find(v => v.name === name) as unknown as Index<T> ?? _throw(createHttp404());
  }
}
