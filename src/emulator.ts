import { _throw } from './lib/_throw';
import { createHttp404 } from './lib/http';
import type { ODataSelect, ODataSelectResult } from './lib/odata';

import type {
  FindDocumentRequest,
  PostDocumentsRequest,
  SearchDocumentsPageResult,
  SearchDocumentsRequest,
  SuggestDocumentsResult,
  Suggester,
  SuggestRequest,
  AutoCompleteRequest,
  AutoCompleteDocumentResult,
  Schema,
  ScoringProfile
} from './services';
import {
  DataStore,
  SearchEngine,
  SuggestEngine,
  AutocompleteEngine,
  SchemaService,
  SearchBackend,
  Scorer
} from './services';

export class Index<T extends object> {
  public static createIndex<T extends object>(options: {
    name: string,
    schema: Schema,
    suggesters?: Suggester[],
    scoringProfiles?: ScoringProfile<T>[],
    defaultScoringProfile?: string,
  }) {
    const schemaService = SchemaService.createSchemaService<T>(options.schema);

    const dataStore = new DataStore<T>(schemaService);
    const scorer = new Scorer<T>(options.scoringProfiles ?? [], options.defaultScoringProfile ?? null);
    const searchBackend = new SearchBackend<T>(schemaService, () => dataStore.documents);
    const searchEngine = new SearchEngine<T>(searchBackend, scorer);
    const suggesterProvider = (name: string) => options.suggesters?.find(s => s.name === name) ?? _throw(new Error(`Unknown suggester ${name}`));
    const suggestEngine = new SuggestEngine<T>(
      searchBackend,
      () => schemaService.keyField,
      suggesterProvider,
    );
    const autocompleteEngine = new AutocompleteEngine<T>(
      searchBackend,
      suggesterProvider,
    )

    return new Index<T>(options.name, dataStore, searchEngine, suggestEngine, autocompleteEngine);
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
  public findDocument<Keys extends ODataSelect<T>>(request: FindDocumentRequest<T, Keys>): ODataSelectResult<T, Keys> {
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
  public autocomplete(request: AutoCompleteRequest): AutoCompleteDocumentResult {
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
  private indices: Index<object>[] = [];

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/create-index
   */
  public createIndex<T extends object>(options: {
    name: string,
    schema: Schema,
    suggesters?: Suggester[],
    scoringProfiles?: ScoringProfile<T>[],
    defaultScoringProfile?: string,
  }): Index<T> {
    const index = Index.createIndex<T>(options);
    this.indices.push(index as unknown as Index<object>);
    return index;
  }

  public getIndex<T extends object>(name: string): Index<T> {
    return this.indices.find(v => v.name === name) as unknown as Index<T> ?? _throw(createHttp404());
  }
}
