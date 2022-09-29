import { _throw } from './lib/_throw';
import { _never } from './lib/_never';

import { select } from './parsers';

export type KeyFieldDefinition = {
  name: string;
  type: 'Edm.String';
  key: true;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: true;
};
export type StringFieldDefinition = {
  name: string;
  type: 'Edm.String';
  key?: false;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type Int32FieldDefinition = {
  name: string;
  type: 'Edm.Int32';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type Int64FieldDefinition = {
  name: string;
  type: 'Edm.Int64';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type DoubleFieldDefinition = {
  name: string;
  type: 'Edm.Double';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type BooleanFieldDefinition = {
  name: string;
  type: 'Edm.Boolean';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type DateTimeOffsetFieldDefinition = {
  name: string;
  type: 'Edm.DateTimeOffset';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type GeographyPointFieldDefinition = {
  name: string;
  type: 'Edm.GeographyPoint';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: false;
  retrievable?: boolean;
};
export type ComplexTypeFieldDefinition = {
  name: string;
  type:  'Edm.ComplexType';
  fields: BasicFieldDefinition[];
};

export type StringCollectionFieldDefinition = {
  name: string;
  type: 'Collection(Edm.String)';
  key?: false;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: false;
  retrievable?: boolean;
};
export type Int32CollectionFieldDefinition = {
  name: string;
  type: 'Collection(Edm.Int32)';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type Int64CollectionFieldDefinition = {
  name: string;
  type: 'Collection(Edm.Int64)';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type DoubleCollectionFieldDefinition = {
  name: string;
  type: 'Collection(Edm.Double)';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type BooleanCollectionFieldDefinition = {
  name: string;
  type: 'Collection(Edm.Boolean)';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type DateTimeOffsetCollectionFieldDefinition = {
  name: string;
  type: 'Collection(Edm.DateTimeOffset)';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type GeographyPointCollectionFieldDefinition = {
  name: string;
  type: 'Collection(Edm.GeographyPoint)';
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: false;
  retrievable?: boolean;
};
export type ComplexTypeCollectionFieldDefinition = {
  name: string;
  type:  'Collection(Edm.ComplexType)';
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
  fields: BasicFieldDefinition[];
};

export type BasicFieldDefinition =
  KeyFieldDefinition |
  StringFieldDefinition |
  Int32FieldDefinition |
  Int64FieldDefinition |
  DoubleFieldDefinition |
  BooleanFieldDefinition |
  DateTimeOffsetFieldDefinition |
  GeographyPointFieldDefinition |
  ComplexTypeFieldDefinition |
  StringCollectionFieldDefinition |
  Int32CollectionFieldDefinition |
  Int64CollectionFieldDefinition |
  DoubleCollectionFieldDefinition |
  BooleanCollectionFieldDefinition |
  DateTimeOffsetCollectionFieldDefinition |
  GeographyPointCollectionFieldDefinition |
  ComplexTypeCollectionFieldDefinition;

export type FieldDefinition = KeyFieldDefinition | BasicFieldDefinition;

function isKeyFieldDefinition(field: FieldDefinition) {
  return field.type === 'Edm.String' && field.key === true;
}

export interface PostDocumentsRequest<TDoc = { [key: string]: unknown }> {
  value: ({
    '@search.action'?: 'upload' | 'merge' | 'mergerOrUpload' | 'delete';
  } & TDoc)[];
}

export interface SearchDocumentsRequest {
  count?: boolean;
  facets?: string[];        //< Facet expressions
  filter?: string;          //< OData Filter expression
  highlight?: string;       //< fields as csv
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  orderBy?: string;         //< OrderBy Expression
  queryType?: 'simple' | 'full';
  search?: string;          //< simple query expression
  searchFields?: string;    //< fields as csv
  searchMode?: 'any' | 'all';
  select?: string;          //< fields as csv
  skip?: number;
  top?: number;
}

export interface SuggestRequest {
  filter?: string;          //< OData Filter expression
  fuzzy?: boolean;
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  orderBy?: string;         //< OrderBy Expression
  search?: string;          //< simple query expression
  searchFields?: string;    //< fields as csv
  select?: string;          //< fields as csv
  top?: number;
}

export interface AutoCompleteRequest {
  autocompleteMode?: 'oneTerm' | 'twoTerms' | 'oneTermWithContext';
  filter?: string;          //< OData Filter expression
  fuzzy?: boolean;
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  search?: string;          //< simple query expression
  searchFields?: string;    //< fields as csv
  top?: number;
}

const createHttpError = (code: number, message: string) => new Error(`[Azure Search Emulator] HTTP ${code} - ${message}`);
const createHttp400 = () => createHttpError(400, 'Invalid Request');
const createHttp404 = () => createHttpError(404, 'Not Found');

type GeoJSONPoint = { type: 'Point', coordinates: number[] };

function buildAssertSchema<T>(fields: FieldDefinition[]): (document: Record<string, unknown>) => T {
  const keyField = fields.find(isKeyFieldDefinition);
  if (!keyField) {
    throw new Error('Invalid schema. Missing KeyFieldDefinition.');
  }

  const isEdmString = (value: unknown) => typeof value === 'string';
  const isKeyString = (value: unknown) => value != null && value != '' && isEdmString(value);
  const isEdmInt32 = (value: unknown) => typeof value === 'number' && value < 2**31 && value > -(2**31) && value % 1 !== 0;
  const isEdmInt64 = (value: unknown) => typeof value === 'number' && value % 1 !== 0;
  const isEdmDouble = (value: unknown) => typeof value === 'number';
  const isEdmBoolean = (value: unknown) => typeof value === 'boolean';
  const isEdmDateTimeOffset = (value: unknown) =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value)) ||
    value instanceof Date;
  const isEdmGeographyPoint = (value: unknown) =>
    typeof value === 'object' && isGeoJSONPoint(value as GeoJSONPoint) ||
    typeof value === 'string' && isWKTPoint(value as string);
  const isGeoJSONPoint = (value: GeoJSONPoint) => value.type === 'Point' && Array.isArray(value.coordinates) && typeof value.coordinates[0] === 'number' && typeof value.coordinates[1] === 'number'
  const wktPointRegex = /^POINT ?\(\d+(\.\d+)? \d+(\.\d+)?\)$/;
  const isWKTPoint = (value: string) => value.match(wktPointRegex)
  const isEdmComplexType = (subTypes: FieldDefinition[], value: unknown) =>
    typeof value === 'object' && validateComplexProp(subTypes, value as Record<string, unknown>);
  const isEdmCollection = (subType: FieldDefinition, value: unknown) =>
    Array.isArray(value) && validateCollectionProp(subType, value as unknown[]);

  function validateSingleProp(field: FieldDefinition, value: unknown): ([] | [FieldDefinition[], string])[] {
    const type = field.type;
    switch (type) {
      case 'Edm.String':
        return isEdmString(value) ? []: [[[field], field.type]];
      case 'Edm.Int32':
        return isEdmInt32(value) ? []: [[[field], field.type]];
      case 'Edm.Int64':
        return isEdmInt64(value) ? []: [[[field], field.type]];
      case 'Edm.Double':
        return isEdmDouble(value) ? []: [[[field], field.type]];
      case 'Edm.Boolean':
        return isEdmBoolean(value) ? []: [[[field], field.type]];
      case 'Edm.DateTimeOffset':
        return isEdmDateTimeOffset(value) ? []: [[[field], field.type]];
      case 'Edm.GeographyPoint':
        return isEdmGeographyPoint(value) ? []: [[[field], field.type]];
      case 'Edm.ComplexType': {
        const result = isEdmComplexType(field.fields, value);

        if (!Array.isArray(result)) {
          return [[[field], field.type]];
        }

        const failures = result.filter(r => r.length) as [FieldDefinition[], string][];
        return failures.map(([fs, m]) => [[field, ...fs], m]);
      }
      case 'Collection(Edm.String)':
      case 'Collection(Edm.Int32)':
      case 'Collection(Edm.Int64)':
      case 'Collection(Edm.Double)':
      case 'Collection(Edm.Boolean)':
      case 'Collection(Edm.DateTimeOffset)':
      case 'Collection(Edm.GeographyPoint)':
      case 'Collection(Edm.ComplexType)': {
        const subType = field.type.substring('Collection('.length, field.type.length - 1);
        const result = isEdmCollection({ ...field, type: subType } as FieldDefinition, value);

        if (!Array.isArray(result)) {
          return [[[field], field.type]];
        }

        const failures = result.filter(r => r.length) as [FieldDefinition[], string][];
        return failures.map(([fs, m]) => [[field, ...fs], m]);
      }
      default:
        return _never(type);
    }
  }

  function validateComplexProp(field: FieldDefinition[], value: Record<string, unknown>): ([] | [FieldDefinition[], string])[] {
    return field.reduce(
      (acc: ([] | [FieldDefinition[], string])[], cur: FieldDefinition) =>
        [...acc, ...validateSingleProp(cur, value[cur.name])],
      []
    );
  }

  function validateCollectionProp(subType: FieldDefinition, value: unknown[]): ([] | [FieldDefinition[], string])[] {
    return value.reduce(
      (acc: ([] | [FieldDefinition[], string])[], cur: unknown) =>
        [...acc, ...validateSingleProp(subType, cur)],
      [],
    );
  }

  return (document) => {
    const key = document[keyField.name]
    if (!isKeyString(key)) {
      throw new Error('Schema assertion failed. Key not found in document.');
    }

    const props = fields
      .filter(f => f.name in document);
    const extraKeys = Object.keys(document)
      .filter(k => !(props.find(f => f.name === k)));
    if (extraKeys.length) {
      throw new Error(`Schema assertion failed. Document ${key} has more properties than expected\n${JSON.stringify(extraKeys)}.`)
    }

    const invalidProps = validateComplexProp(props, document);

    if (invalidProps.length) {
      throw new Error(`Schema assertion failed. Document ${key} failed validation on props:\n${JSON.stringify(invalidProps, null, ' ')}`);
    }

    return document as T;
  };
}

export class Index<T extends {}> {
  private documents: T[] = [];

  private keySelector = (doc: T) => (doc as Record<string, unknown>)[this.keyField.name] as string;

  public static createIndex<T extends {}>(
    name: string,
    fields: FieldDefinition[]
  ) {
    const keyField = fields.find(isKeyFieldDefinition);

    if (!keyField) {
      throw createHttp400();
    }

    return new Index<T>(name, fields, keyField as KeyFieldDefinition, buildAssertSchema<T>(fields));
  }

  private constructor(
    public readonly name: string,
    // @ts-ignore
    private readonly fields: FieldDefinition[],
    private readonly keyField: KeyFieldDefinition,
    private readonly assertSchema: (document: Record<string, unknown>) => T,
  ) {
  }

  private matchExisting(document: T, match: (docs: T[], existing: T, index: number) => void, miss: (docs: T[]) => void) {
    return (docs: T[]) => {
      const index = docs.findIndex(d => this.keySelector(d) === this.keySelector(document));
      return index
        ? match(docs, docs[index]!, index)
        : miss(docs);
    }
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/addupdate-or-delete-documents
   * @param documents
   */
  public postDocuments(documents: PostDocumentsRequest<T>) {
    const transforms = documents.value.map(v => {
      const { '@search.action': action, ...request } = v;
      const document = this.assertSchema(request);

      switch (action) {
        case 'upload':
        case undefined:
          return this.matchExisting(document, (docs, _, index) => { docs[index] = document }, (docs) => { docs.push(document); });
        case 'merge':
          return this.matchExisting(document, (_, existing) => { Object.assign(existing, document); }, () => _throw(createHttp404()));
        case 'mergerOrUpload':
          return this.matchExisting(document, (_, existing) => { Object.assign(existing, document); }, (docs) => { docs.push(document); });
        case 'delete':
          return this.matchExisting(document, (docs, _, index) => { docs.splice(index, 1); }, () => {});
        default:
          _never(action);
      }
    });

    for (const transform of transforms) {
      transform(this.documents);
    }
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/lookup-document
   * @param key
   * @param $select
   */
  public lookupDocument(key: string, $select?: string) {
    const ast = $select && select.parse($select) || undefined;
    const document = this.documents.find(d => this.keySelector(d) === key) ?? _throw(createHttp404());
    return ast ? ast.apply(document) : document;
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/count-documents
   */
  public countDocuments() {
    return this.documents.length;
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/search-documents
   * @param request
   */
  // @ts-ignore
  public searchDocuments(request: SearchDocumentsRequest) {
    // TODO: Apply request
    return this.documents;
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/suggestions
   * @param request
   */
  // @ts-ignore
  public suggest(request: SuggestRequest) {
    // TODO: Apply request
    return this.documents;
  }

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/autocomplete
   * @param request
   */
  // @ts-ignore
  public autoComplete(request: AutoCompleteRequest) {
    // TODO: Apply request
    return '';
  }
}

export class Emulator {
  private indexes: Index<{}>[] = [];

  /**
   * https://learn.microsoft.com/en-us/rest/api/searchservice/create-index
   */
  public createIndex(name: string, fields: FieldDefinition[]) {
    this.indexes.push(Index.createIndex(name, fields));
  }

  public getIndex<T extends {}>(name: string): Index<T> {
    return this.indexes.find(v => v.name === name) as unknown as Index<T> ?? _throw(createHttp404());
  }
}
