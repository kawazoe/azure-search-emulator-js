import { describe, expect, it } from 'vitest';
import { FieldDefinition, validateSchema } from '../src/services/schema';
import { People, peopleSchema } from './lib/mockSchema';

describe('Schema', () => {
  describe('validateSchema', () => {
    it('should fail if no key is provided', () => {
      expect(() => validateSchema([])).toThrowError(/KeyFieldDefinition/);
    });

    it('should fail if the same field name is used twice', () => {
      const schema: FieldDefinition[] = [
        { type: 'Edm.String', key: true, name: 'foo' },
        { type: 'Edm.String', name: 'bar' },
        { type: 'Edm.Int32', name: 'bar' },
      ]
      expect(() => validateSchema(schema)).toThrowError(/Duplicate/);
    });

    it('should return keyField, flatSchema, and assertSchema', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar' };
      const schema: FieldDefinition[] = [key, bar];
      const { keyField, flatSchema, assertSchema } = validateSchema(schema);

      expect(keyField).toBe(key);
      expect(flatSchema).toEqual([
        ['foo', key],
        ['bar', bar],
      ]);
      expect(assertSchema).toBeTypeOf('function');
    });

    it('should flatten complex field', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const baz: FieldDefinition = { type: 'Edm.String', name: 'baz' };
      const buz: FieldDefinition = { type: 'Edm.String', name: 'buz' };
      const bar: FieldDefinition = { type: 'Edm.ComplexType', name: 'bar', fields: [baz, buz] };
      const schema: FieldDefinition[] = [key, bar];
      const { flatSchema } = validateSchema(schema);

      expect(flatSchema).toEqual([
        ['foo', key],
        ['bar', bar],
        ['bar/baz', baz],
        ['bar/buz', buz],
      ]);
    });

    it('should flatten complex field collections', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const baz: FieldDefinition = { type: 'Edm.String', name: 'baz' };
      const buz: FieldDefinition = { type: 'Edm.String', name: 'buz' };
      const bar: FieldDefinition = { type: 'Collection(Edm.ComplexType)', name: 'bar', fields: [baz, buz] };
      const schema: FieldDefinition[] = [key, bar];
      const { flatSchema } = validateSchema(schema);

      expect(flatSchema).toEqual([
        ['foo', key],
        ['bar', bar],
        ['bar/baz', baz],
        ['bar/buz', buz],
      ]);
    });
  });

  describe('assertSchema', () => {
    it('should fail when the key is not present', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const schema: FieldDefinition[] = [key];
      const { assertSchema } = validateSchema(schema);

      expect(() => assertSchema({})).toThrowError(/Key not found/);
    });

    it('succeed with a minimal valid schema and matching document', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const schema: FieldDefinition[] = [key];
      const { assertSchema } = validateSchema(schema);

      const result = assertSchema({ foo: 'abc' });

      expect(result).toEqual({ foo: 'abc' });
    });

    it('succeed with a complex valid schema and matching document', () => {
      const { assertSchema } = validateSchema<People>(peopleSchema);

      const result = assertSchema({
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
