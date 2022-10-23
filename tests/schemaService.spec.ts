import { describe, expect, it } from 'vitest';

import type { FieldDefinition } from '../src';
import { SchemaService } from '../src';

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
      expect(sut.fullSchema).toHaveLength(1);
    });

    // TODO: Test pre-computed schemas and merge with Schema.specs
  });
});
