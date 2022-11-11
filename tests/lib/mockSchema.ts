import type {
  KeyFieldDefinition,
  Schema,
  StoredDocument,
  Suggester
} from '../../src';
import {
  AnalyzerService,
  SchemaService,
} from '../../src';

import { _throw } from '../../src/lib/_throw';
import type { GeoJSONPoint, WKTPoint } from '../../src/lib/geo';

export type People = {
  id: string,
  fullName?: string,
  addresses?: {
    parts?: string,
    kind?: string,
    location?: GeoJSONPoint | WKTPoint
  }[],
  phones?: string[],
  ratio?: number,
  income?: number,
  metadata?: {
    createdBy?: string,
    createdOn?: Date,
    editCounter?: number,
    deleted?: boolean,
    tags?: string[],
  },
}
export const peopleSchemaKey: KeyFieldDefinition = { type: 'Edm.String', key: true, name: 'id' };
export const peopleSchema: Schema = [
  peopleSchemaKey,
  { type: 'Edm.String', name: 'fullName', analyzer: 'simple' },
  { type: 'Collection(Edm.ComplexType)', name: 'addresses', fields: [
      { type: 'Edm.String', name: 'parts', analyzer: 'simple' },
      { type: 'Edm.String', name: 'kind', analyzer: 'keyword' },
      { type: 'Edm.GeographyPoint', name: 'location' },
    ]},
  { type: 'Collection(Edm.String)', name: 'phones', analyzer: 'keyword' },
  { type: 'Edm.Double', name: 'ratio' },
  { type: 'Edm.Int64', name: 'income' },
  { type: 'Edm.ComplexType', name: 'metadata', fields: [
      { type: 'Edm.String', name: 'createdBy', analyzer: 'simple' },
      { type: 'Edm.DateTimeOffset', name: 'createdOn' },
      { type: 'Edm.Int32', name: 'editCounter' },
      { type: 'Edm.Boolean', name: 'deleted' },
      { type: 'Collection(Edm.String)', name: 'tags' },
    ]},
];

export const peopleSchemaService = SchemaService.createSchemaService<People>(peopleSchema);
export const peopleAnalyzer = new AnalyzerService(peopleSchemaService);

const peopleSuggesters: Suggester[] = [
  {
    name: 'sg',
    searchMode: 'analyzingInfixMatching',
    fields: peopleSchemaService.suggestableSchema.map(e => e.name),
  },
];
export const peopleSuggesterProvider = (name: string) => peopleSuggesters.find(s => s.name === name) ?? _throw(new Error(`Unknown suggester ${name}`));

export function peopleToStoredDocument(document: People): StoredDocument<People> {
  return {
    key: (document as Record<string, unknown>)[peopleSchemaKey.name] as string,
    original: document,
    analyzed: peopleAnalyzer.analyzeDocument(document),
  };
}
