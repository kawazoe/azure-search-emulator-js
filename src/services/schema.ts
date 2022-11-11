import { _never } from '../lib/_never';
import { CustomError } from '../lib/errors';
import { groupBy, isIterable } from '../lib/iterables';
import { isGeoJsonPoint, isWKTPoint} from '../lib/geo';
import { DeepKeyOf } from '../lib/types';

import * as Parsers from '../parsers';
import { AnalyzerId, createParseDocument, ParsedDocument } from './analyzis';

export type EdmString = 'Edm.String';
export type EdmInt32 = 'Edm.Int32';
export type EdmInt64 = 'Edm.Int64';
export type EdmDouble = 'Edm.Double';
export type EdmBoolean = 'Edm.Boolean';
export type EdmDateTimeOffset = 'Edm.DateTimeOffset';
export type EdmGeographyPoint = 'Edm.GeographyPoint';
export type EdmComplexType = 'Edm.ComplexType';

export type EdmCollection<EdmT extends string> = `Collection(${EdmT})`;

export type KeyFieldDefinition = {
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
};
export type StringFieldDefinition = {
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
};
export type Int32FieldDefinition = {
  name: string;
  type: EdmInt32;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type Int64FieldDefinition = {
  name: string;
  type: EdmInt64;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type DoubleFieldDefinition = {
  name: string;
  type: EdmDouble;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type BooleanFieldDefinition = {
  name: string;
  type: EdmBoolean;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type DateTimeOffsetFieldDefinition = {
  name: string;
  type: EdmDateTimeOffset;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
};
export type GeographyPointFieldDefinition = {
  name: string;
  type: EdmGeographyPoint;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: false;
  retrievable?: boolean;
};
export type ComplexTypeFieldDefinition = {
  name: string;
  type:  EdmComplexType;
  fields: BasicFieldDefinition[];
};
export type StringCollectionFieldDefinition = {
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
};

export type Int32CollectionFieldDefinition = {
  name: string;
  type: EdmCollection<EdmInt32>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type Int64CollectionFieldDefinition = {
  name: string;
  type: EdmCollection<EdmInt64>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type DoubleCollectionFieldDefinition = {
  name: string;
  type: EdmCollection<EdmDouble>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type BooleanCollectionFieldDefinition = {
  name: string;
  type: EdmCollection<EdmBoolean>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type DateTimeOffsetCollectionFieldDefinition = {
  name: string;
  type: EdmCollection<EdmDateTimeOffset>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
};
export type GeographyPointCollectionFieldDefinition = {
  name: string;
  type: EdmCollection<EdmGeographyPoint>;
  key?: false;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: false;
  retrievable?: boolean;
};
export type ComplexTypeCollectionFieldDefinition = {
  name: string;
  type:  EdmCollection<EdmComplexType>;
  searchable?: false;
  filterable?: boolean;
  sortable?: false;
  facetable?: boolean;
  retrievable?: boolean;
  fields: BasicFieldDefinition[];
};

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
export type FlatSchemaEntry<T extends object> = { key: DeepKeyOf<T>, path: string[], field: FieldDefinition };
export type FlatSchema<T extends object> = FlatSchemaEntry<T>[];

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

function createAssertSchema<T>(keyField: KeyFieldDefinition, fields: FieldDefinition[]): (document: Record<string, unknown>) => T {
  return (document) => {
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
  };
}

function *flattenSchema<T extends object>(schema: FieldDefinition[]): Iterable<FlatSchemaEntry<T>> {
  for (const field of schema) {
    yield { key: field.name as DeepKeyOf<T>, path: [field.name], field };

    if (field.type === 'Edm.ComplexType' || field.type === 'Collection(Edm.ComplexType)') {
      const subFields = flattenSchema(field.fields);

      for (const sub of subFields) {
        yield { key: `${field.name}/${sub.key}`, path: [field.name, ...sub.path], field: sub.field };
      }
    }
  }
}

export function validateSchema<T extends object>(schema: Schema) {
  const keyField = schema.find(isKeyFieldDefinition);
  if (!keyField) {
    throw new SchemaError('Invalid schema. Missing KeyFieldDefinition.')
  }

  const flatSchema: FlatSchema<T> = Array.from(flattenSchema(schema));
  const duplicateFields = groupBy(flatSchema, (e) => e.key)
    .filter(g => g.results.length > 1);

  if (duplicateFields.length) {
    throw new SchemaError('Invalid schema. Duplicated fields', duplicateFields);
  }

  const assertSchema = createAssertSchema<T>(keyField, schema);
  const parseDocument = createParseDocument<T>(flatSchema);

  return {
    keyField,
    flatSchema,
    assertSchema,
    parseDocument,
  };
}

export type SchemaMatcherRequirements = 'searchable' | 'filterable' | 'sortable' | 'facetable' | 'retrievable';

const searchableTypes: FieldDefinition['type'][] = ['Edm.String', 'Collection(Edm.String)'];
const notFilterableTypes: FieldDefinition['type'][] = ['Edm.ComplexType', 'Collection(Edm.ComplexType)'];
const sortableTypes: FieldDefinition['type'][] = ['Edm.String', 'Edm.Int32', 'Edm.Int64', 'Edm.Double', 'Edm.Boolean', 'Edm.DateTimeOffset', 'Edm.GeographyPoint'];
const notFacetableTypes: FieldDefinition['type'][] = ['Edm.ComplexType', 'Collection(Edm.ComplexType)', 'Edm.GeographyPoint', 'Collection(Edm.GeographyPoint)'];

function matchRequirementFieldType(field: FieldDefinition, require: SchemaMatcherRequirements) {
  switch (require) {
    case 'searchable':
      return searchableTypes.includes(field.type);
    case 'filterable':
      return !notFilterableTypes.includes(field.type);
    case 'sortable':
      return sortableTypes.includes(field.type);
    case 'facetable':
      return !notFacetableTypes.includes(field.type);
    case 'retrievable':
      return true;
  }
}

function matchFieldRequirement(field: FieldDefinition, require: SchemaMatcherRequirements, fieldPath: string): string | null {
  if (!matchRequirementFieldType(field, require)) {
    return `Field '${fieldPath}'s type prevent it from being ${require}.`;
  }

  if ((field as any)[require] === false) {
    return `Field '${fieldPath}' is not ${require} in schema.`;
  }

  return null;
}

export function matchSchemaRequirement<T extends object>(schema: FlatSchema<T>, key: string, require: SchemaMatcherRequirements): string | null {
  const entry = schema.find((e) => key === e.key);
  return entry
    ? matchFieldRequirement(entry.field, require, key)
    : `Field '${key}' not found in schema.`;
}

export class SchemaService<T extends object> {
  public static createSchemaService<T extends object>(schema: Schema) {
    const { keyField, flatSchema, assertSchema, parseDocument } = validateSchema<T>(schema);
    
    return new SchemaService(
      keyField,
      flatSchema,
      flatSchema.filter(({ key, field }) => matchFieldRequirement(field, 'searchable', key) == null),
      flatSchema.filter(({ key, field }) => matchFieldRequirement(field, 'filterable', key) == null),
      flatSchema.filter(({ key, field }) => matchFieldRequirement(field, 'sortable', key) == null),
      flatSchema.filter(({ key, field }) => matchFieldRequirement(field, 'facetable', key) == null),
      flatSchema.filter(({ key, field }) => matchFieldRequirement(field, 'retrievable', key) == null),
      assertSchema,
      parseDocument,
    );
  }
  
  constructor(
    public readonly keyField: KeyFieldDefinition,
    public readonly fullSchema: FlatSchema<T>,
    public readonly searchableSchema: FlatSchema<T>,
    public readonly filtrableSchema: FlatSchema<T>,
    public readonly sortableSchema: FlatSchema<T>,
    public readonly facetableSchema: FlatSchema<T>,
    public readonly retrievableSchema: FlatSchema<T>,
    public readonly assertSchema: (document: Record<string, unknown>) => T,
    public readonly parseDocument: (document: T) => ParsedDocument<T>,
  ) {
  }

  public assertCommands(request: {
    filterCommand?: Parsers.FilterParserResult,
    orderByCommand?: Parsers.OrderByParserResult,
    selectCommand?: Parsers.SelectParserResult,
    searchFieldsCommand?: Parsers.SelectParserResult,
    highlightCommand?: Parsers.HighlighParserResult,
    facetCommands?: Parsers.FacetParserResult[],
  }): void {
    const requirementFailures: string[] = [
      ...(request.filterCommand?.canApply(this.filtrableSchema) ?? []),
      ...(request.orderByCommand?.canApply(this.sortableSchema) ?? []),
      ...(request.selectCommand?.canApply(this.retrievableSchema) ?? []),
      ...(request.searchFieldsCommand?.canApply(this.searchableSchema) ?? []),
      ...(request.highlightCommand?.canApply(this.searchableSchema) ?? []),
      ...((request.facetCommands ?? []).flatMap(f => f.canApply(this.facetableSchema))),
    ];

    if (requirementFailures.length) {
      throw new SchemaError('Part of the request is not compatible with the current schema', requirementFailures);
    }
  }
}