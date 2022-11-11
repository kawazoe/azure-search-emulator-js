import { describe, expect, it } from 'vitest';

import { select as parser } from '../src/parsers';

describe('query-select', () => {
  describe('apply', () => {
    function itShouldSelect(raw: string, source: unknown, expected: unknown) {
      it(`should select ${raw}`, () => {
        const ast = parser.parse(raw);
        const actual = ast.apply(source);

        expect(actual).to.deep.equal(expected);
      });
    }

    itShouldSelect(
      'foo, bar, biz, baz/foo, baz/fuz, buz/fiz, buz/bom',
      {
        foo: 1,
        bar: 2,
        biz: [3, 4],
        baz: {
          foo: 5,
          fiz: 6,
          fuz: 7,
        },
        buz: [
          {
            foo: 8,
            fiz: 9,
            bom: 10,
          },
          {
            foo: 11,
            fiz: 12,
            bom: 13,
          }
        ]
      },
      {
        foo: 1,
        bar: 2,
        biz: [ 3, 4 ],
        baz: { foo: 5, fuz: 7 },
        buz: [ { fiz: 9, bom: 10 }, { fiz: 12, bom: 13 } ]
      }
    );
  });
});
