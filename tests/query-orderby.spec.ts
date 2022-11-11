import { describe, expect, it } from 'vitest';

import { orderBy as parser } from '../src/parsers';

describe('query-select', () => {
  describe('apply', () => {
    function itShouldSort(raw: string, source: unknown[], expected: unknown[]) {
      it(`should sort ${raw} ${JSON.stringify(source)}`, () => {
        const ast = parser.parse(raw);
        const actual = source.sort(ast.apply);

        expect(actual).to.deep.equal(expected);
      });
    }

    itShouldSort(
      'foo',
      [ { foo: 3 }, { foo: 1 }, { foo: 2 } ],
      [ { foo: 1 }, { foo: 2 }, { foo: 3 } ],
    );
    itShouldSort(
      'foo asc',
      [ { foo: 3 }, { foo: 1 }, { foo: 2 } ],
      [ { foo: 1 }, { foo: 2 }, { foo: 3 } ],
    );
    itShouldSort(
      'foo',
      [ { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 1, foo: 2 } ],
      [ { bar: 1, foo: 1 }, { bar: 1, foo: 2 }, { bar: 1, foo: 3 } ],
    );
    itShouldSort(
      'bar',
      [ { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 1, foo: 2 } ],
      [ { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 1, foo: 2 } ],
    );
    itShouldSort(
      'foo, bar',
      [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
      [ { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 }, { bar: 1, foo: 3 }, { bar: 2, foo: 3 } ],
    );
    itShouldSort(
      'foo asc, bar asc',
      [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
      [ { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 }, { bar: 1, foo: 3 }, { bar: 2, foo: 3 } ],
    );
    itShouldSort(
      'foo desc',
      [ { foo: 3 }, { foo: 1 }, { foo: 2 } ],
      [ { foo: 3 }, { foo: 2 }, { foo: 1 } ],
    );
    itShouldSort(
      'foo desc',
      [ { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 1, foo: 2 } ],
      [ { bar: 1, foo: 3 }, { bar: 1, foo: 2 }, { bar: 1, foo: 1 } ],
    );
    itShouldSort(
      'foo desc, bar',
      [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
      [ { bar: 1, foo: 3 }, { bar: 2, foo: 3 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 }, { bar: 1, foo: 1 } ],
    );
    itShouldSort(
      'foo, bar desc',
      [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
      [ { bar: 1, foo: 1 }, { bar: 4, foo: 2 }, { bar: 2, foo: 2 }, { bar: 2, foo: 3 }, { bar: 1, foo: 3 } ],
    );
    itShouldSort(
      'foo asc, bar desc',
      [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
      [ { bar: 1, foo: 1 }, { bar: 4, foo: 2 }, { bar: 2, foo: 2 }, { bar: 2, foo: 3 }, { bar: 1, foo: 3 } ],
    );
    itShouldSort(
      'foo desc, bar desc',
      [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
      [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 4, foo: 2 }, { bar: 2, foo: 2 }, { bar: 1, foo: 1 } ],
    );
    itShouldSort(
      'search.score()',
      [ { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 }, { '@search.score': 1, foo: 2 } ],
      [ { '@search.score': 1, foo: 2 }, { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 } ],
    );
    itShouldSort(
      'search.score() asc',
      [ { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 }, { '@search.score': 1, foo: 2 } ],
      [ { '@search.score': 1, foo: 2 }, { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 } ],
    );
    itShouldSort(
      'search.score() desc',
      [ { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 }, { '@search.score': 1, foo: 2 } ],
      [ { '@search.score': 3, foo: 1 }, { '@search.score': 2, foo: 3 }, { '@search.score': 1, foo: 2 } ],
    );
  });
});
