import { _never } from '../lib/_never';
import { CustomError } from '../lib/errors';
import { groupBy, isIterable } from '../lib/iterables';
import { isGeoJsonPoint, isWKTPoint } from '../lib/geo';

import * as Parsers from '../parsers';
import { AnalyzerId } from './analyzerService';

export const edmString = 'Edm.String' as const;
export const edmInt32 = 'Edm.Int32' as const;
export const edmInt64 = 'Edm.Int64' as const;
export const edmDouble = 'Edm.Double' as const;
export const edmBoolean = 'Edm.Boolean' as const;
export const edmDateTimeOffset = 'Edm.DateTimeOffset' as const;
export const edmGeographyPoint = 'Edm.GeographyPoint' as const;
export const edmComplexType = 'Edm.ComplexType' as const;

export type EdmString = typeof edmString;
export type EdmInt32 = typeof edmInt32;
export type EdmInt64 = typeof edmInt64;
export type EdmDouble = typeof edmDouble;
export type EdmBoolean = typeof edmBoolean;
export type EdmDateTimeOffset = typeof edmDateTimeOffset;
export type EdmGeographyPoint = typeof edmGeographyPoint;
export type EdmComplexType = typeof edmComplexType;

export type EdmCollection<EdmT extends string> = `Collection(${EdmT})`;
export const edmCollection = <TEdm extends string>(edm: TEdm) => `Collection(${edm})` as EdmCollection<TEdm>;

export interface KeyFieldDefinition {
  name: string;
  type: EdmString;
  key: true;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: true;
  analyzer?: AnalyzerId,
  searchAnalyzer?: AnalyzerId;
  indexAnalyzer?: AnalyzerId;
}

export interface StringFieldDefinition {
  name: string;
  type: EdmString;
  key?: false;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
  analyzer?: AnalyzerId,
  searchAnalyzer?: AnalyzerId;
  indexAnalyzer?: AnalyzerId;
}

export interface Int32FieldDefinition {
  name: string;
  type: EdmInt32;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface Int64FieldDefinition {
  name: string;
  type: EdmInt64;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface DoubleFieldDefinition {
  name: string;
  type: EdmDouble;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface BooleanFieldDefinition {
  name: string;
  type: EdmBoolean;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface DateTimeOffsetFieldDefinition {
  name: string;
  type: EdmDateTimeOffset;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface GeographyPointFieldDefinition {
  name: string;
  type: EdmGeographyPoint;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: false;
  retrievable?: boolean;
}

export interface ComplexTypeFieldDefinition {
  name: string;
  type: EdmComplexType;
  fields: BasicFieldDefinition[];
}

export interface StringCollectionFieldDefinition {
  name: string;
  type: EdmCollection<EdmString>;
  key?: false;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: false;
  retrievable?: boolean;
  analyzer?: AnalyzerId,
  searchAnalyzer?: AnalyzerId;
  indexAnalyzer?: AnalyzerId;
}

export interface Int32CollectionFieldDefinition {
  name: string;
  type: EdmCollection<EdmInt32>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface Int64CollectionFieldDefinition {
  name: string;
  type: EdmCollection<EdmInt64>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface DoubleCollectionFieldDefinition {
  name: string;
  type: EdmCollection<EdmDouble>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface BooleanCollectionFieldDefinition {
  name: string;
  type: EdmCollection<EdmBoolean>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface DateTimeOffsetCollectionFieldDefinition {
  name: string;
  type: EdmCollection<EdmDateTimeOffset>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
}

export interface GeographyPointCollectionFieldDefinition {
  name: string;
  type: EdmCollection<EdmGeographyPoint>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: false;
  retrievable?: boolean;
}

export interface ComplexTypeCollectionFieldDefinition {
  name: string;
  type: EdmCollection<EdmComplexType>;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
  fields: BasicFieldDefinition[];
}

export type BasicFieldDefinition =
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
export type Schema = FieldDefinition[];

export type AllStringField = KeyFieldDefinition | StringFieldDefinition | StringCollectionFieldDefinition;
export type AllComplexField = ComplexTypeFieldDefinition | ComplexTypeCollectionFieldDefinition;

export type RetrievableField = Exclude<FieldDefinition, AllComplexField>;
export type SearchableField = AllStringField;
export type FilterableField = Exclude<FieldDefinition, AllComplexField>;
export type SortableField = KeyFieldDefinition | StringFieldDefinition | Int32FieldDefinition | Int64FieldDefinition | DoubleFieldDefinition | BooleanFieldDefinition | DateTimeOffsetFieldDefinition | GeographyPointFieldDefinition;
export type FacetableField = Exclude<FieldDefinition, AllComplexField | GeographyPointFieldDefinition | GeographyPointCollectionFieldDefinition>;
export type SuggestableField = SearchableField;

const allStringTypes:         string[] = [edmString, edmCollection(edmString)];
const allComplexTypes:        string[] = [edmComplexType, edmCollection(edmComplexType)];

const notRetrievableTypes: string[] = [...allComplexTypes];
const searchableTypes:     string[] = [...allStringTypes];
const notFilterableTypes:  string[] = [...allComplexTypes];
const sortableTypes:       string[] = [edmString, edmInt32, edmInt64, edmDouble, edmBoolean, edmDateTimeOffset, edmGeographyPoint];
const notFacetableTypes:   string[] = [...allComplexTypes, edmGeographyPoint, edmCollection(edmGeographyPoint)];

const hasRetrievable = (field: FieldDefinition): field is RetrievableField => !notRetrievableTypes.includes(field.type);
const hasSearchable  = (field: FieldDefinition): field is SearchableField  => searchableTypes.includes(field.type);
const hasFilterable  = (field: FieldDefinition): field is FilterableField  => !notFilterableTypes.includes(field.type);
const hasSortable    = (field: FieldDefinition): field is SortableField    => sortableTypes.includes(field.type);
const hasFacetable   = (field: FieldDefinition): field is FacetableField   => !notFacetableTypes.includes(field.type);

type FlatFieldDefinition = { name: string; path: string[], field: FieldDefinition };

export type Retrievable = { name: string, path: string[], field: RetrievableField | AllComplexField };
export type Searchable  = { name: string, path: string[], field: SearchableField };
export type Filterable  = { name: string, path: string[], field: FilterableField };
export type Sortable    = { name: string, path: string[], field: SortableField };
export type Facetable   = { name: string, path: string[], field: FacetableField };
export type Suggestable = { name: string, path: string[], field: SuggestableField };

export type AnalyzableBasic     = { name: string, path: string[], field: SearchableField | FilterableField, isFullText: false };
export type AnalyzableFullText  = { name: string, path: string[], field: SearchableField, isFullText: true };
export type Analyzable  = AnalyzableBasic | AnalyzableFullText;

function asMatchRequirement<TFlat extends FlatFieldDefinition>(
  flat: FlatFieldDefinition,
  reqFn: (field: FieldDefinition) =>  boolean
) {
  if (reqFn(flat.field)) {
    return flat as TFlat;
  }
  return null;
}

const asRetrievable = (field: FlatFieldDefinition) => asMatchRequirement<Retrievable>(field, f => hasRetrievable(f) && (f.retrievable ?? true) || allComplexTypes.includes(f.type));
const asSearchable  = (field: FlatFieldDefinition) => asMatchRequirement<Searchable>(field, f => hasSearchable(f) && (f.searchable ?? true));
const asFilterable  = (field: FlatFieldDefinition) => asMatchRequirement<Filterable>(field, f => hasFilterable(f) && (f.filterable ?? true));
const asSortable    = (field: FlatFieldDefinition) => asMatchRequirement<Sortable>(field, f => hasSortable(f) && (f.sortable ?? true));
const asFacetable   = (field: FlatFieldDefinition) => asMatchRequirement<Facetable>(field, f => hasFacetable(f) && (f.facetable ?? true));
const asSuggestable = (field: FlatFieldDefinition): Suggestable | null => searchableTypes.includes(field.field.type) ? field as Suggestable : null;
const asAnalyzable  = (field: FlatFieldDefinition): Analyzable  | null => {
  const isSsearchable = hasSearchable(field.field) && field.field.searchable !== false;
  const isFilterable = hasFilterable(field.field) && field.field.filterable !== false;
  const isGeo = field.field.type === edmGeographyPoint || field.field.type === edmCollection(edmGeographyPoint);

  return isSsearchable || isFilterable || isGeo
    ? { ...field, isFullText: isSsearchable } as Analyzable
    : null;
};

export function isKeyFieldDefinition(field: FieldDefinition): field is KeyFieldDefinition {
  return field.type === 'Edm.String' && field.key === true;
}

const isEdmString = (value: unknown) => typeof value === 'string';
const isKeyString = (value: unknown) => value != null && value != '' && isEdmString(value);
const isEdmInt32 = (value: unknown) => typeof value === 'number' && value < 2**31 && value > -(2**31) && value % 1 === 0;
const isEdmInt64 = (value: unknown) => typeof value === 'number' && value % 1 === 0;
const isEdmDouble = (value: unknown) => typeof value === 'number';
const isEdmBoolean = (value: unknown) => typeof value === 'boolean';
const isEdmDateTimeOffset = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ||
  value instanceof Date;
const isEdmGeographyPoint = (value: unknown) =>
  typeof value === 'object' && isGeoJsonPoint(value) ||
  typeof value === 'string' && isWKTPoint(value);
const isEdmComplexType = (subTypes: FieldDefinition[], value: unknown) =>
  typeof value === 'object' && validateComplexProp(subTypes, value as Record<string, unknown>);
const isEdmCollection = (subType: FieldDefinition, value: unknown) =>
  Array.isArray(value) && value.flatMap(f => validateSingleProp(subType, f));

export class SchemaError extends CustomError {
  constructor(message: string, public json?: any) {
    super(json ? `${message}:\n${JSON.stringify(json, null, ' ')}` : message);
  }
}

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

      if (!isIterable(result)) {
        return [[[field], field.type]];
      }

      return result
        .filter((r): r is [FieldDefinition[], string] => !!r.length)
        .map(([fs, m]) => [[field, ...fs], m] as [FieldDefinition[], string]);
    }
    default:
      return _never(type);
  }
}

function validateComplexProp(fields: FieldDefinition[], value: Record<string, unknown>): ([] | [FieldDefinition[], string])[] {
  const props = fields
    .filter(f => f.name in value);
  const extraKeys = Object.keys(value)
    .filter(k => !(props.find(f => f.name === k)));

  if (extraKeys.length) {
    throw new SchemaError(`has more properties than expected`, extraKeys);
  }

  const invalidProps = props
    .map(prop => ({ prop, get: value[prop.name] }))
    .filter(prop => prop.get != null)
    .reduce(
    (acc: ([] | [FieldDefinition[], string])[], { prop, get }) =>
      [...acc, ...validateSingleProp(prop, get)],
    []
  );

  if (invalidProps.length) {
    throw new SchemaError(`failed validation on props`, invalidProps);
  }

  return invalidProps;
}

function assertSchema<T>(keyField: KeyFieldDefinition, fields: FieldDefinition[], document: Record<string, unknown>): T {
  const key = document[keyField.name]
  if (!isKeyString(key)) {
    throw new SchemaError('Schema assertion failed. Key not found in document.');
  }

  try {
    validateComplexProp(fields, document);
  } catch (e: unknown) {
    if (e instanceof SchemaError) {
      throw new SchemaError(`Schema assertion failed. Document ${key} ${e.message}`, e.json);
    }

    throw e;
  }

  return document as T;
}

function *flattenSchema(schema: FieldDefinition[]): Iterable<FlatFieldDefinition> {
  for (const field of schema) {
    yield {
      name: field.name,
      path: [field.name],
      field,
    };

    if (field.type === 'Edm.ComplexType' || field.type === 'Collection(Edm.ComplexType)') {
      const subFields = flattenSchema(field.fields);

      for (const sub of subFields) {
        yield {
          name: `${field.name}/${sub.name}`,
          path: [field.name, ...sub.path],
          field: sub.field,
        };
      }
    }
  }
}

// TODO: Shouldn't be exported
export function validateSchema(schema: Schema) {
  const keyField = schema.find(isKeyFieldDefinition);
  if (!keyField) {
    throw new SchemaError('Invalid schema. Missing KeyFieldDefinition.')
  }

  const flatSchema = Array.from(flattenSchema(schema));
  const duplicateFields = groupBy(flatSchema, (e) => e.name)
    .filter(g => g.results.length > 1);

  if (duplicateFields.length) {
    throw new SchemaError('Invalid schema. Duplicated fields', duplicateFields);
  }

  const explode = <T>(mapper: (f: FlatFieldDefinition) => T | null) => flatSchema
    .map(mapper)
    .filter((f): f is T => !!f);

  return {
    keyField,
    retrievableSchema: explode(asRetrievable),
    searchableSchema: explode(asSearchable),
    filterableSchema: explode(asFilterable),
    sortableSchema: explode(asSortable),
    facetableSchema: explode(asFacetable),
    suggestableSchema: explode(asSuggestable),
    analyzableSchema: explode(asAnalyzable),
  }
}

export class SchemaService<T extends object> {
  public static createSchemaService<T extends object>(schema: Schema) {
    const {
      keyField,
      retrievableSchema,
      searchableSchema,
      filterableSchema,
      sortableSchema,
      facetableSchema,
      suggestableSchema,
      analyzableSchema,
    } = validateSchema(schema);

    return new SchemaService(
      keyField,
      retrievableSchema,
      searchableSchema,
      filterableSchema,
      sortableSchema,
      facetableSchema,
      suggestableSchema,
      analyzableSchema,
      (document: Record<string, unknown>) => assertSchema<T>(keyField, schema, document),
    );
  }

  constructor(
    public readonly keyField: KeyFieldDefinition,
    public readonly retrievableSchema: Retrievable[],
    public readonly searchableSchema: Searchable[],
    public readonly filtrableSchema: Filterable[],
    public readonly sortableSchema: Sortable[],
    public readonly facetableSchema: Facetable[],
    public readonly suggestableSchema: Suggestable[],
    public readonly analyzableSchema: Analyzable[],
    public readonly assertDocumentSchema: (document: Record<string, unknown>) => T,
  ) {
  }

  public assertCommands(request: {
    selectCommand?: Parsers.SelectParserResult,
    searchFieldsCommand?: Parsers.SelectParserResult,
    filterCommand?: Parsers.FilterParserResult,
    orderByCommand?: Parsers.OrderByParserResult,
    highlightCommand?: Parsers.HighlighParserResult,
    facetCommands?: Parsers.FacetParserResult[],
  }): void {
    const requirementFailures: string[] = [
      ...(request.selectCommand?.canApply(this.retrievableSchema) ?? []),
      ...(request.searchFieldsCommand?.canApply(this.searchableSchema) ?? []),
      ...(request.filterCommand?.canApply(this.filtrableSchema) ?? []),
      ...(request.orderByCommand?.canApply(this.sortableSchema) ?? []),
      ...(request.highlightCommand?.canApply(this.searchableSchema) ?? []),
      ...((request.facetCommands ?? []).flatMap(f => f.canApply(this.facetableSchema))),
    ];

    if (requirementFailures.length) {
      throw new SchemaError('Part of the request is not compatible with the current schema', requirementFailures);
    }
  }
}
