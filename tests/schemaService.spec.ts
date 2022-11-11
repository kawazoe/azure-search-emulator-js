import { describe, expect, it } from 'vitest';

import type { FieldDefinition } from '../src';
import { SchemaService } from '../src';
import { People, peopleSchema } from './lib/mockSchema';

describe('SchemaService', () => {
  describe('validation', () => {
    it('should fail if no key is provided', () => {
      expect(() => SchemaService.createSchemaService([])).toThrowError(/KeyFieldDefinition/);
    });

    it('should create', () => {
      const schema: FieldDefinition[] = [
        { type: 'Edm.String', key: true, name: 'foo' }
      ];
      const sut = SchemaService.createSchemaService(schema);

      expect(sut).toBeInstanceOf(SchemaService);
      expect(sut.keyField.type).toBe('Edm.String');
      expect(sut.keyField.key).toBe(true);
      expect(sut.keyField.name).toBe('foo');
    });

    // TODO: Test pre-computed schemas and merge with Schema.specs
  });

  describe('assertSchema', () => {
    it('should fail when the key is not present', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const schema: FieldDefinition[] = [key];

      const sut = SchemaService.createSchemaService(schema);

      expect(() => sut.assertDocumentSchema({})).toThrowError(/Key not found/);
    });

    it('succeed with a minimal valid schema and matching document', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const schema: FieldDefinition[] = [key];

      const sut = SchemaService.createSchemaService(schema);

      const result = sut.assertDocumentSchema({ foo: 'abc' });

      expect(result).toEqual({ foo: 'abc' });
    });

    it('succeed with a complex valid schema and matching document', () => {
      const sut = SchemaService.createSchemaService(peopleSchema);

      const result = sut.assertDocumentSchema({
        id: 'abc',
        fullName: 'Foo Bar',
        addresses: [
          { kind: 'home', parts: '12 home street' },
          { kind: 'work', parts: '34 work road' },
        ],
        phones: ['555-123-4567'],
        ratio: 0.34,
        income: 120_000,
        metadata: {
          createdBy: 'mock',
          createdOn: new Date('1970-01-01'),
          editCounter: 3,
          deleted: false,
        },
      } as People);

      expect(result).toEqual({
        id: 'abc',
        fullName: 'Foo Bar',
        addresses: [
          { kind: 'home', parts: '12 home street' },
          { kind: 'work', parts: '34 work road' },
        ],
        phones: ['555-123-4567'],
        ratio: 0.34,
        income: 120_000,
        metadata: {
          createdBy: 'mock',
          createdOn: new Date('1970-01-01'),
          editCounter: 3,
          deleted: false
        },
      });
    });

    // TODO: Add a test for all failure modes
  });
});
