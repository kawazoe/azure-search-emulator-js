import { FieldDefinition, FlatSchema, Schema } from '../../src/services/schema';

export type People = {
  id: string,
  fullName?: string,
  addresses?: {
    parts?: string,
    kind?: string,
  }[],
  phones?: string[],
  ratio?: number,
  income?: number,
  metadata?: {
    createdBy?: string,
    createdOn?: Date,
    editCounter?: number,
    deleted?: boolean,
  },
}
export const peopleSchema: Schema = [
  { type: 'Edm.String', key: true, name: 'id' },
  { type: 'Edm.String', name: 'fullName' },
  { type: 'Collection(Edm.ComplexType)', name: 'addresses', fields: [
      { type: 'Edm.String', name: 'parts' },
      { type: 'Edm.String', name: 'kind' },
    ]},
  { type: 'Collection(Edm.String)', name: 'phones' },
  { type: 'Edm.Double', name: 'ratio' },
  { type: 'Edm.Int64', name: 'income' },
  { type: 'Edm.ComplexType', name: 'metadata', fields: [
      { type: 'Edm.String', name: 'createdBy' },
      { type: 'Edm.DateTimeOffset', name: 'createdOn' },
      { type: 'Edm.Int32', name: 'editCounter' },
      { type: 'Edm.Boolean', name: 'deleted' },
    ]},
];

const parts: FieldDefinition = { type: 'Edm.String', name: 'parts' };
const kind: FieldDefinition = { type: 'Edm.String', name: 'kind' };

const createdBy: FieldDefinition = { type: 'Edm.String', name: 'createdBy' };
const createdOn: FieldDefinition = { type: 'Edm.DateTimeOffset', name: 'createdOn' };
const editCounter: FieldDefinition = { type: 'Edm.Int32', name: 'editCounter' };
const deleted: FieldDefinition = { type: 'Edm.Boolean', name: 'deleted' };

export const flatPeopleSchema: FlatSchema = [
  ['id', { type: 'Edm.String', key: true, name: 'id' }],
  ['fullName', { type: 'Edm.String', name: 'fullName' }],
  ['addresses', { type: 'Collection(Edm.ComplexType)', name: 'addresses', fields: [parts, kind] }],
  ['addresses/parts', parts],
  ['addresses/kind', kind],
  ['phones', { type: 'Collection(Edm.String)', name: 'phones' }],
  ['ratio', { type: 'Edm.Double', name: 'ratio' }],
  ['income', { type: 'Edm.Int64', name: 'income' }],
  ['metadata', { type: 'Edm.ComplexType', name: 'metadata', fields: [createdBy, createdOn, editCounter, deleted] }],
  ['metadata/createdBy', createdBy],
  ['metadata/createdOn', createdOn],
  ['metadata/editCounter', editCounter],
  ['metadata/deleted', deleted],
];