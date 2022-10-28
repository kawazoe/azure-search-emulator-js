import { _never } from '../lib/_never';
import { CustomError } from '../lib/errors';
import { groupBy, isIterable } from '../lib/iterables';
import * as Parsers from '../parsers';

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
export type FlatSchemaEntry = [string, string[], FieldDefinition];
export type FlatSchema = FlatSchemaEntry[];

export function isKeyFieldDefinition(field: FieldDefinition): field is KeyFieldDefinition {
  return field.type === 'Edm.String' && field.key === true;
}

export type GeoJSONPoint = { type: 'Point', coordinates: number[] };

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
  typeof value === 'object' && isGeoJSONPoint(value as GeoJSONPoint) ||
  typeof value === 'string' && isWKTPoint(value as string);
const isGeoJSONPoint = (value: GeoJSONPoint) => value.type === 'Point' && Array.isArray(value.coordinates) && typeof value.coordinates[0] === 'number' && typeof value.coordinates[1] === 'number'
const wktPointRegex = /^POINT ?\(\d+(\.\d+)? \d+(\.\d+)?\)$/;
const isWKTPoint = (value: string) => value.match(wktPointRegex)
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

function *flattenSchema(schema: FieldDefinition[]): Iterable<[string, string[], FieldDefinition]> {
  for (const field of schema) {
    yield [field.name, [field.name], field];

    if (field.type === 'Edm.ComplexType' || field.type === 'Collection(Edm.ComplexType)') {
      const subFields = flattenSchema(field.fields);

      for (const [subName, subPath, subField] of subFields) {
        yield [`${field.name}/${subName}`, [field.name, ...subPath], subField];
      }
    }
  }
}

export function validateSchema<T extends object>(schema: Schema) {
  const keyField = schema.find(isKeyFieldDefinition);
  if (!keyField) {
    throw new SchemaError('Invalid schema. Missing KeyFieldDefinition.')
  }

  const flatSchema: FlatSchema = Array.from(flattenSchema(schema));
  const duplicateFields = groupBy(flatSchema, ([p]) => p)
    .filter(g => g.results.length > 1);

  if (duplicateFields.length) {
    throw new SchemaError('Invalid schema. Duplicated fields', duplicateFields);
  }

  const assertSchema = createAssertSchema<T>(keyField, schema);

  return {
    keyField,
    flatSchema,
    assertSchema,
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

export function matchSchemaRequirement(schema: FlatSchema, fieldPath: string, require: SchemaMatcherRequirements): string | null {
  const definition = schema.find(([p]) => fieldPath === p);
  return definition
    ? matchFieldRequirement(definition[2], require, fieldPath)
    : `Field '${fieldPath}' not found in schema.`;
}

export class SchemaService<T extends object> {
  public static createSchemaService<T extends object>(schema: Schema) {
    const { keyField, flatSchema, assertSchema } = validateSchema<T>(schema);
    
    return new SchemaService(
      keyField,
      flatSchema,
      flatSchema.filter(([n,, f]) => matchFieldRequirement(f, 'searchable', n) == null),
      flatSchema.filter(([n,, f]) => matchFieldRequirement(f, 'filterable', n) == null),
      flatSchema.filter(([n,, f]) => matchFieldRequirement(f, 'sortable', n) == null),
      flatSchema.filter(([n,, f]) => matchFieldRequirement(f, 'facetable', n) == null),
      flatSchema.filter(([n,, f]) => matchFieldRequirement(f, 'retrievable', n) == null),
      assertSchema,
    );
  }
  
  constructor(
    public readonly keyField: KeyFieldDefinition,
    public readonly fullSchema: FlatSchema,
    public readonly searchableSchema: FlatSchema,
    public readonly filtrableSchema: FlatSchema,
    public readonly sortableSchema: FlatSchema,
    public readonly facetableSchema: FlatSchema,
    public readonly retrievableSchema: FlatSchema,
    public readonly assertSchema: (document: Record<string, unknown>) => T,
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