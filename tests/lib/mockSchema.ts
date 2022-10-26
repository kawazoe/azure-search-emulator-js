import { KeyFieldDefinition, Schema, SchemaService, Suggester } from '../../src';
import { _throw } from '../../src/lib/_throw';

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
export const peopleSchemaKey: KeyFieldDefinition = { type: 'Edm.String', key: true, name: 'id' };
export const peopleSchema: Schema = [
  peopleSchemaKey,
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

export const peopleSchemaService = SchemaService.createSchemaService<People>(peopleSchema);

const peopleSuggesters: Suggester[] = [
  {
    name: 'sg',
    searchMode: 'analyzingInfixMatching',
    fields: peopleSchemaService.fullSchema
      .filter(([,,f]) => f.type === 'Edm.String' || f.type === 'Collection(Edm.String)')
      .map(([n]) => n)
  }
];
export const peopleSuggesterProvider = (name: string) => peopleSuggesters.find(s => s.name === name) ?? _throw(new Error(`Unknown suggester ${name}`));