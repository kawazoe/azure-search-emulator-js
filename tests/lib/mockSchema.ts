import type {
  KeyFieldDefinition,
  ParsedDocument,
  Schema,
  StoredDocument,
  Suggester
} from '../../src';
import {
  SchemaService,
} from '../../src';

import { _throw } from '../../src/lib/_throw';
import type { GeoJSONPoint, WKTPoint } from '../../src/lib/geo';
import { _never } from '../../src/lib/_never';
import type { DeepKeyOf } from '../../src/lib/types';

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
  },
}
export const peopleSchemaKey: KeyFieldDefinition = { type: 'Edm.String', key: true, name: 'id' };
export const peopleSchema: Schema = [
  peopleSchemaKey,
  { type: 'Edm.String', name: 'fullName' },
  { type: 'Collection(Edm.ComplexType)', name: 'addresses', fields: [
      { type: 'Edm.String', name: 'parts' },
      { type: 'Edm.String', name: 'kind' },
      { type: 'Edm.GeographyPoint', name: 'location' },
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

export function peopleToStoredDocument(document: People): StoredDocument<People> {
  return {
    key: (document as Record<string, unknown>)[peopleSchemaKey.name] as string,
    original: document,
    parsed: peopleSchemaService.parseDocument(document),
  };
}

export function hydrateParsedProxies<T extends object>(document: ParsedDocument<T>): void {
  for (const key in document) {
    const target = document[key as DeepKeyOf<T>] ?? _never(document as never);

    if (target.kind === 'text') {
      target.normalized;
      target.words;
    }
    if (target.kind === 'geo') {
      target.points;
    }
    if (target.kind === 'generic') {
      target.normalized;
    }
  }
}
