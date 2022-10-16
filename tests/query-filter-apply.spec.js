import { describe, expect, it } from 'vitest';

import { filter as parser } from '../src/parsers';

describe('query-select', () => {
  describe('apply', () => {
    function itShouldFilter(raw, source, expected) {
      it(`should filter ${raw}`, () => {
        const ast = parser.parse(raw);
        const actual = source.map(d => [ast.apply(d), d]);

        expect(actual).to.deep.equal(expected);
      });
    }

    itShouldFilter(
      'foo eq 42',
      [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
      [[0, { foo: 41, bar: 42 }], [0, { fo: 42 }], [1, { foo: 42, bar: 41 }]]
    )
    itShouldFilter(
      'foo eq 42 or bar gt 41',
      [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
      [[1, { foo: 41, bar: 42 }], [0, { fo: 42 }], [1, { foo: 42, bar: 41 }]]
    )
    itShouldFilter(
      'foo eq 41 or bar gt 41',
      [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
      [[2, { foo: 41, bar: 42 }], [0, { fo: 42 }], [0, { foo: 42, bar: 41 }]]
    )
    itShouldFilter(
      'foo eq 41 and bar gt 41',
      [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
      [[2, { foo: 41, bar: 42 }], [0, { fo: 42 }], [0, { foo: 42, bar: 41 }]]
    )
    itShouldFilter(
      'foo eq 41 and (bar gt 41 or fo eq null)',
      [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
      [[4, { foo: 41, bar: 42 }], [0, { fo: 42 }], [0, { foo: 42, bar: 41 }]]
    )
    itShouldFilter(
      'foo/bar eq 41',
      [{ foo: { bar: 41 }, bar: 42 }, { foo: { bar: 42 }, bar: 41 }],
      [[1, { foo: { bar: 41 }, bar: 42 }], [0, { foo: { bar: 42 }, bar: 41 }]]
    )
    itShouldFilter(
      "foo/any(v:v eq 'faz')",
      [{ foo: ['fiz', 'faz', 'fuz', 'fir', 'buz' ] }, { foo: ['fiz', 'fuz', 'fir', 'buz' ] }],
      [[1, { foo: ['fiz', 'faz', 'fuz', 'fir', 'buz' ] }], [0, { foo: ['fiz', 'fuz', 'fir', 'buz' ] }]]
    )
    itShouldFilter(
      "foo/any(v:search.in(v, 'f'))",
      [{ foo: ['fiz', 'faz', 'fuz', 'fir', 'buz' ] }, { foo: ['fiz', 'fuz', 'fir', 'buz' ] }],
      [[4, { foo: ['fiz', 'faz', 'fuz', 'fir', 'buz' ] }], [3, { foo: ['fiz', 'fuz', 'fir', 'buz' ] }]]
    )
    itShouldFilter(
      "foo/all(v:v eq 0)",
      [{ foo: [0, 0, 0] }, { foo: [0, 1, 0] }],
      [[3, { foo: [0, 0, 0] }], [0, { foo: [0, 1, 0] }]]
    )
    itShouldFilter(
      "search.ismatchscoring('z', 'foo')",
      [{ foo: 'fiz faz fuz fir buz' }, { foo: 'fiz fuz fir buz' }],
      [[1, { foo: 'fiz faz fuz fir buz' }], [1, { foo: 'fiz fuz fir buz' }]]
    )
    itShouldFilter(
      "search.ismatchscoring('z', 'foo', 'full', 'any')",
      [{ foo: 'fiz faz fuz fir buz' }, { foo: 'fiz fuz fir buz' }],
      [[4, { foo: 'fiz faz fuz fir buz' }], [3, { foo: 'fiz fuz fir buz' }]]
    )
    itShouldFilter(
      "search.ismatch('z', 'foo', 'full', 'any')",
      [{ foo: 'fiz faz fuz fir buz' }, { foo: 'fiz fuz fir buz' }],
      [[1, { foo: 'fiz faz fuz fir buz' }], [1, { foo: 'fiz fuz fir buz' }]]
    )
  });
});
