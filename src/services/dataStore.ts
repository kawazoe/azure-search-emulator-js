import { _throw } from '../lib/_throw';
import { _never } from '../lib/_never';
import { select } from '../parsers';
import { createAssertSchema, FieldDefinition, isKeyFieldDefinition, KeyFieldDefinition } from './schema';
import { createHttp400, createHttp404 } from '../lib/http';
import { toArray } from '../lib/generators';

export interface FindDocumentRequest {
  key: string;
  select?: string;          //< fields as csv
}

export interface PostDocumentsRequest<TDoc> {
  value: ({
    '@search.action'?: 'upload' | 'merge' | 'mergerOrUpload' | 'delete';
  } & TDoc)[];
}

function *flattenSchema(schema: FieldDefinition[]): IterableIterator<[string, FieldDefinition]> {
  for (const field of schema) {
    yield [field.name, field];

    if (field.type === 'Edm.ComplexType' || field.type === 'Collection(Edm.ComplexType)') {
      const subFields = flattenSchema(field.fields);

      for (const [subName, subField] of subFields) {
        yield [`${field.name}/${subName}`, subField];
      }
    }
  }
}

export class DataStore<T extends object> {
  public readonly documents: T[] = [];
  public readonly keySelector = (doc: T) => (doc as Record<string, unknown>)[this.keyField.name] as string;

  public static createDataStore<T extends object>(
    schema: FieldDefinition[],
  ) {
    const keyField = schema.find(isKeyFieldDefinition);

    if (!keyField) {
      throw createHttp400();
    }

    return new DataStore<T>(
      schema,
      toArray(flattenSchema(schema)),
      keyField as KeyFieldDefinition,
      createAssertSchema<T>(schema)
    );
  }

  constructor(
    public readonly schema: FieldDefinition[],
    public readonly flatSchema: [string, FieldDefinition][],
    public readonly keyField: KeyFieldDefinition,
    private readonly assertSchema: (document: Record<string, unknown>) => T,
  ) {
  }

  private matchExisting(document: T, match: (docs: T[], existing: T, index: number) => void, miss: (docs: T[]) => void) {
    const index = this.documents.findIndex(d => this.keySelector(d) === this.keySelector(document));
    return index
      ? match(this.documents, this.documents[index]!, index)
      : miss(this.documents);
  }

  public findDocument(request: FindDocumentRequest): Partial<T> {
    const document = this.documents.find(d => this.keySelector(d) === request.key) ?? _throw(createHttp404());
    const selectAst = request.select && select.parse(request.select) || undefined;
    return selectAst ? selectAst.apply(document) : document;
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