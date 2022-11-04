import { _throw } from '../lib/_throw';
import { _never } from '../lib/_never';
import { createHttp404 } from '../lib/http';
import type { ODataSelect, ODataSelectResult } from '../lib/odata';

import { select } from '../parsers';
import { KeyFieldDefinition, ParsedDocument, SchemaService } from './schema';

export interface FindDocumentRequest<T extends object, Keys extends ODataSelect<T>> {
  key: string;
  select?: Keys[];          //< fields as csv
}

export interface PostDocumentsRequest<TDoc> {
  value: ({
    '@search.action'?: 'upload' | 'merge' | 'mergerOrUpload' | 'delete';
  } & TDoc)[];
}

export type StoredDocument<T extends object> = { key: string, original: T, parsed: ParsedDocument<T> };

function toStoredDocument<T extends object>(document: T, key: KeyFieldDefinition, parse: (document: T) => any): StoredDocument<T> {
  return {
    key: (document as Record<string, unknown>)[key.name] as string,
    original: document,
    parsed: parse(document),
  };
}

function assignStoredDocument<T extends object>(left: StoredDocument<T>, right: StoredDocument<T>): StoredDocument<T> {
  if (left.key !== right.key) {
    throw new Error(`Invalid operation. Cannot merge documents with different keys: "${left.key}" and "${right.key}".`);
  }

  Object.assign(left.original, right.original);
  Object.assign(left.parsed, right.parsed);

  return left;
}

export class DataStore<T extends object> {
  public readonly documents: StoredDocument<T>[] = [];

  constructor(
    public readonly schema: SchemaService<T>,
  ) {
  }

  private matchExisting(document: StoredDocument<T>, match: (docs: StoredDocument<T>[], existing: StoredDocument<T>, index: number) => void, miss: (docs: StoredDocument<T>[]) => void) {
    const index = this.documents.findIndex(d => d.key === document.key);
    return index >= 0
      ? match(this.documents, this.documents[index]!, index)
      : miss(this.documents);
  }

  public findDocument<Keys extends ODataSelect<T>>(request: FindDocumentRequest<T, Keys>): ODataSelectResult<T, Keys> {
    const document = this.documents.find(d => d.key === request.key)?.original ?? _throw(createHttp404());
    const selectAst = request.select && select.parse(request.select.join(', ')) || undefined;
    const result = selectAst ? selectAst.apply(document) : document;
    return result as ODataSelectResult<T, Keys>;
  }

  public postDocuments(documents: PostDocumentsRequest<T>) {
    for (const { '@search.action': action, ...request } of documents.value) {
      const document = toStoredDocument(this.schema.assertSchema(request), this.schema.keyField, this.schema.parseDocument);

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
            (_, existing) => { assignStoredDocument(existing, document); },
            () => _throw(createHttp404())
          );
          break;
        case 'mergerOrUpload':
          this.matchExisting(
            document,
            (_, existing) => { assignStoredDocument(existing, document); },
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