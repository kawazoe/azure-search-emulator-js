import { _throw } from '../lib/_throw';
import { _never } from '../lib/_never';
import { createHttp404 } from '../lib/http';
import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import { select } from '../parsers';
import type { FlatSchema, KeyFieldDefinition, Schema } from './schema';
import {  validateSchema } from './schema';

export interface FindDocumentRequest<T extends object, Keys extends ODataSelect<T>> {
  key: string;
  select?: Keys[];          //< fields as csv
}

export interface PostDocumentsRequest<TDoc> {
  value: ({
    '@search.action'?: 'upload' | 'merge' | 'mergerOrUpload' | 'delete';
  } & TDoc)[];
}

export class DataStore<T extends object> {
  public readonly documents: T[] = [];
  public readonly keySelector = (doc: T) => (doc as Record<string, unknown>)[this.keyField.name] as string;

  public static createDataStore<T extends object>(
    schema: Schema,
  ) {
    const { keyField, flatSchema, assertSchema } = validateSchema<T>(schema);

    return new DataStore<T>(
      schema,
      flatSchema,
      keyField,
      assertSchema,
    );
  }

  constructor(
    public readonly schema: Schema,
    public readonly flatSchema: FlatSchema,
    public readonly keyField: KeyFieldDefinition,
    private readonly assertSchema: (document: Record<string, unknown>) => T,
  ) {
  }

  private matchExisting(document: T, match: (docs: T[], existing: T, index: number) => void, miss: (docs: T[]) => void) {
    const index = this.documents.findIndex(d => this.keySelector(d) === this.keySelector(document));
    return index >= 0
      ? match(this.documents, this.documents[index]!, index)
      : miss(this.documents);
  }

  public findDocument<Keys extends ODataSelect<T>>(request: FindDocumentRequest<T, Keys>): ODataSelectResult<T, Keys> {
    const document = this.documents.find(d => this.keySelector(d) === request.key) ?? _throw(createHttp404());
    const selectAst = request.select && select.parse(request.select.join(', ')) || undefined;
    const result = selectAst ? selectAst.apply(document) : document;
    return result as ODataSelectResult<T, Keys>;
  }

  public postDocuments(documents: PostDocumentsRequest<T>) {
    for (const { '@search.action': action, ...request } of documents.value) {
      const document = this.assertSchema(request);

      switch (action) {
        case 'upload':
        case undefined:
          this.matchExisting(
            document,
            (docs, _, index) => { docs[index] = document },
            (docs) => { docs.push(document); }
          );
          break;
        case 'merge':
          this.matchExisting(
            document,
            (_, existing) => { Object.assign(existing, document); },
            () => _throw(createHttp404())
          );
          break;
        case 'mergerOrUpload':
          this.matchExisting(
            document,
            (_, existing) => { Object.assign(existing, document); },
            (docs) => { docs.push(document); }
          );
          break;
        case 'delete':
          this.matchExisting(
            document,
            (docs, _, index) => { docs.splice(index, 1); },
            () => {}
          );
          break;
        default:
          _never(action);
      }
    }
  }

  public countDocuments(): number {
    return this.documents.length;
  }
}