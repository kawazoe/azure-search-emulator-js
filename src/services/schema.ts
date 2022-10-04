import { _never } from '../lib/_never';
import { CustomError } from '../lib/errors';

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
function createKeyField(definition: Omit<KeyFieldDefinition, 'type' | 'key'>): KeyFieldDefinition {
  return { type: 'Edm.String', key: true, ...definition };
}
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
function createStringField(definition: Omit<StringFieldDefinition, 'type'>): StringFieldDefinition {
  return { type: 'Edm.String', ...definition };
}
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
function createInt64Field(definition: Omit<Int64FieldDefinition, 'type'>): Int64FieldDefinition {
  return { type: 'Edm.Int64', ...definition };
}
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
function createInt32Field(definition: Omit<Int32FieldDefinition, 'type'>): Int32FieldDefinition {
  return { type: 'Edm.Int32', ...definition };
}
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
function createDoubleField(definition: Omit<DoubleFieldDefinition, 'type'>): DoubleFieldDefinition {
  return { type: 'Edm.Double', ...definition };
}
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
function createBooleanField(definition: Omit<BooleanFieldDefinition, 'type'>): BooleanFieldDefinition {
  return { type: 'Edm.Boolean', ...definition };
}
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
function createDateTimeOffsetField(definition: Omit<DateTimeOffsetFieldDefinition, 'type'>): DateTimeOffsetFieldDefinition {
  return { type: 'Edm.DateTimeOffset', ...definition };
}
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
function createGeographyPointField(definition: Omit<GeographyPointFieldDefinition, 'type'>): GeographyPointFieldDefinition {
  return { type: 'Edm.GeographyPoint', ...definition };
}
export type ComplexTypeFieldDefinition = {
  name: string;
  type:  'Edm.ComplexType';
  fields: BasicFieldDefinition[];
};
function createComplexTypeField(definition: Omit<ComplexTypeFieldDefinition, 'type'>): ComplexTypeFieldDefinition {
  return { type: 'Edm.ComplexType', ...definition };
}

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
function createStringCollectionField(definition: Omit<StringCollectionFieldDefinition, 'type'>): StringCollectionFieldDefinition {
  return { type: 'Collection(Edm.String)', ...definition };
}
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
function createInt32CollectionField(definition: Omit<Int32CollectionFieldDefinition, 'type'>): Int32CollectionFieldDefinition {
  return { type: 'Collection(Edm.Int32)', ...definition };
}
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
function createInt64CollectionField(definition: Omit<Int64CollectionFieldDefinition, 'type'>): Int64CollectionFieldDefinition {
  return { type: 'Collection(Edm.Int64)', ...definition };
}
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
function createDoubleCollectionField(definition: Omit<DoubleCollectionFieldDefinition, 'type'>): DoubleCollectionFieldDefinition {
  return { type: 'Collection(Edm.Double)', ...definition };
}
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
function createBooleanCollectionField(definition: Omit<BooleanCollectionFieldDefinition, 'type'>): BooleanCollectionFieldDefinition {
  return { type: 'Collection(Edm.Boolean)', ...definition };
}
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
function createDateTimeOffsetCollectionField(definition: Omit<DateTimeOffsetCollectionFieldDefinition, 'type'>): DateTimeOffsetCollectionFieldDefinition {
  return { type: 'Collection(Edm.DateTimeOffset)', ...definition };
}
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
function createGeographyPointCollectionField(definition: Omit<GeographyPointCollectionFieldDefinition, 'type'>): GeographyPointCollectionFieldDefinition {
  return { type: 'Collection(Edm.GeographyPoint)', ...definition };
}
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
function createComplexTypeCollectionField(definition: Omit<ComplexTypeCollectionFieldDefinition, 'type'>): ComplexTypeCollectionFieldDefinition {
  return { type: 'Collection(Edm.ComplexType)', ...definition };
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

export const fields = {
  key: createKeyField,
  string: createStringField,
  int64: createInt64Field,
  int32: createInt32Field,
  double: createDoubleField,
  boolean: createBooleanField,
  dateTimeOffset: createDateTimeOffsetField,
  geographyPoint: createGeographyPointField,
  complexType: createComplexTypeField,

  collections: {
    string: createStringCollectionField,
    int64: createInt64CollectionField,
    int32: createInt32CollectionField,
    double: createDoubleCollectionField,
    boolean: createBooleanCollectionField,
    dateTimeOffset: createDateTimeOffsetCollectionField,
    geographyPoint: createGeographyPointCollectionField,
    complexType: createComplexTypeCollectionField,
  }
};

export function isKeyFieldDefinition(field: FieldDefinition) {
  return field.type === 'Edm.String' && field.key === true;
}

export type GeoJSONPoint = { type: 'Point', coordinates: number[] };

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

function validateComplexProp(fields: FieldDefinition[], value: Record<string, unknown>): ([] | [FieldDefinition[], string])[] {
  const props = fields
    .filter(f => f.name in value);
  const extraKeys = Object.keys(value)
    .filter(k => !(props.find(f => f.name === k)));

  if (extraKeys.length) {
    throw new SchemaError(`has more properties than expected`, extraKeys);
  }

  const invalidProps = fields.reduce(
    (acc: ([] | [FieldDefinition[], string])[], cur: FieldDefinition) =>
      [...acc, ...validateSingleProp(cur, value[cur.name])],
    []
  );

  if (invalidProps.length) {
    throw new SchemaError(`failed validation on props`, invalidProps);
  }

  return invalidProps;
}

function validateCollectionProp(subType: FieldDefinition, value: unknown[]): ([] | [FieldDefinition[], string])[] {
  return value.reduce(
    (acc: ([] | [FieldDefinition[], string])[], cur: unknown) =>
      [...acc, ...validateSingleProp(subType, cur)],
    [],
  );
}

export function createAssertSchema<T>(fields: FieldDefinition[]): (document: Record<string, unknown>) => T {
  const keyField = fields.find(isKeyFieldDefinition);
  if (!keyField) {
    throw new SchemaError('Invalid schema. Missing KeyFieldDefinition.');
  }

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
