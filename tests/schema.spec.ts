import { describe, expect, it } from 'vitest';

import type { FieldDefinition } from '../src';
import { validateSchema } from '../src';

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

    it('should return keyField', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar' };
      const schema: FieldDefinition[] = [key, bar];
      const { keyField } = validateSchema(schema);

      expect(keyField).toBe(key);
    });

    it('should build specialized schemas (retrievable)', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar', retrievable: false };
      const schema: FieldDefinition[] = [key, bar];
      const { retrievableSchema } = validateSchema(schema);

      expect(retrievableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
      ]);
    });

    it('should build specialized schemas (filterable)', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar', filterable: false };
      const schema: FieldDefinition[] = [key, bar];
      const { filterableSchema } = validateSchema(schema);

      expect(filterableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
      ]);
    });

    it('should build specialized schemas (sortable)', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar', sortable: false };
      const schema: FieldDefinition[] = [key, bar];
      const { sortableSchema } = validateSchema(schema);

      expect(sortableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
      ]);
    });

    it('should build specialized schemas (searchable)', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar', searchable: false };
      const schema: FieldDefinition[] = [key, bar];
      const { searchableSchema } = validateSchema(schema);

      expect(searchableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
      ]);
    });

    it('should build specialized schemas (facetable)', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar', facetable: false };
      const schema: FieldDefinition[] = [key, bar];
      const { facetableSchema } = validateSchema(schema);

      expect(facetableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
      ]);
    });

    it.todo('should build specialized meta schemas (suggestable)', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar' };
      const schema: FieldDefinition[] = [key, bar];
      const { facetableSchema } = validateSchema(schema);

      expect(facetableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
      ]);
    });

    it.todo('should build specialized meta schemas (analyzable)', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const bar: FieldDefinition = { type: 'Edm.String', name: 'bar' };
      const schema: FieldDefinition[] = [key, bar];
      const { facetableSchema } = validateSchema(schema);

      expect(facetableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
      ]);
    });

    it('should flatten complex field', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const baz: FieldDefinition = { type: 'Edm.String', name: 'baz' };
      const buz: FieldDefinition = { type: 'Edm.String', name: 'buz' };
      const bar: FieldDefinition = { type: 'Edm.ComplexType', name: 'bar', fields: [baz, buz] };
      const schema: FieldDefinition[] = [key, bar];
      const { retrievableSchema } = validateSchema(schema);

      expect(retrievableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
        { name: 'bar', path: ['bar'], field: bar },
        { name: 'bar/baz', path: ['bar', 'baz'], field: baz },
        { name: 'bar/buz', path: ['bar', 'buz'], field: buz },
      ]);
    });

    it('should flatten complex field collections', () => {
      const key: FieldDefinition = { type: 'Edm.String', key: true, name: 'foo' };
      const baz: FieldDefinition = { type: 'Edm.String', name: 'baz' };
      const buz: FieldDefinition = { type: 'Edm.String', name: 'buz' };
      const bar: FieldDefinition = { type: 'Collection(Edm.ComplexType)', name: 'bar', fields: [baz, buz] };
      const schema: FieldDefinition[] = [key, bar];
      const { retrievableSchema } = validateSchema(schema);

      expect(retrievableSchema).toEqual([
        { name: 'foo', path: ['foo'], field: key },
        { name: 'bar', path: ['bar'], field: bar },
        { name: 'bar/baz', path: ['bar', 'baz'], field: baz },
        { name: 'bar/buz', path: ['bar', 'buz'], field: buz },
      ]);
    });
  });
});
