import { describe, expect, it } from 'vitest';

import { AnalyzerFn, createSimpleQueryStrategy, tokenize } from '../src';

describe('query-simple', () => {
  describe('apply', () => {
    const simpleAnalyzer: AnalyzerFn = v => tokenize(v, /(\s+)/);
    
    function itShouldScore(
      query: string,
      searchMode: 'any' | 'all' | null,
      entry: string,
      // Actual score is not important for these tests. Only the input to the scorer represented by the range, is important.
      expected: { ngrams: string[], range: [number, number], '@not'?: true }[]
    ) {
      const exp = expected.map(e => ({
        ...(e['@not'] ? { '@not': e['@not'] } : {}),
        ngrams: e.ngrams,
        score: (1 - e.range[0] / entry.length) * (e.range[1] - e.range[0]),
      }));

      it(`should score ${query} ${searchMode} ${entry}`, () => {
        const strat = createSimpleQueryStrategy({ search: query, searchMode: searchMode ?? 'any' });
        const actual = strat({ type: 'Edm.String', name: 'n/a', analyzer: 'simple' }).apply(simpleAnalyzer(entry));
        const matches = actual.map(m => ({
          ...m,
          ngrams: m.ngrams.map(n => n.value),
        }));

        expect(matches).to.deep.equal(exp);
      });
    }

    describe('phrase', () => {
      itShouldScore('', null, '', []);
      itShouldScore(
        'foo', null,
        'f fo foo oo o',
        [{ ngrams: ['foo'], range: [5, 8] }],
      );
      itShouldScore(
        'foo', null,
        'foo fooo ffoo',
        [{ ngrams: ['foo'], range: [0, 3] }],
      );
      itShouldScore(
        'foo', null,
        'foo foo',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['foo'], range: [4, 7] },
        ],
      );

      itShouldScore(
        '"foo bar"', null,
        'foo b foo ba foo bar oo bar o bar',
        [{ ngrams: ['foo', 'bar'], range: [13, 20] }],
      );
      itShouldScore(
        '"foo bar"', null,
        'foo bar fooo bar ffoo bar foo barr foo bbar',
        [{ ngrams: ['foo', 'bar'], range: [0, 7] }],
      );
      itShouldScore(
        '"foo bar"', null,
        'foo bar foo bar',
        [
          { ngrams: ['foo', 'bar'], range: [0, 7] },
          { ngrams: ['foo', 'bar'], range: [8, 15] },
        ],
      );
    });

    describe('clause', () => {
      itShouldScore(
        'fo*', null,
        'f fo foo foobar',
        [
          { ngrams: ['fo'], range: [2, 4] },
          { ngrams: ['foo'], range: [5, 7] },
          { ngrams: ['foobar'], range: [9, 11] },
        ],
      );

      itShouldScore(
        '"foo b"*', null,
        'f fo foo foobar foo b foo ba foo bar foo barr',
        [
          { ngrams: ['foo', 'b'], range: [16, 21] },
          { ngrams: ['foo', 'ba'], range: [22, 27] },
          { ngrams: ['foo', 'bar'], range: [29, 34] },
          { ngrams: ['foo', 'barr'], range: [37, 42] },
        ],
      );
    });

    describe('expression not', () => {
      itShouldScore(
        'foo - bar', 'any',
        'foo bar',
        [
          { ngrams: ['foo'], range: [0, 3] },
        ],
      );
      itShouldScore(
        'foo - bar', 'any',
        'foo biz',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { '@not': true, ngrams: ['bar'], range: [0, 3] },
        ],
      );
      itShouldScore(
        'foo - bar', 'any',
        'bar',
        [],
      );

      itShouldScore(
        'foo - bar', 'all',
        'foo bar',
        [],
      );
      itShouldScore(
        'foo - bar', 'all',
        'foo biz',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { '@not': true, ngrams: ['bar'], range: [0, 3] },
        ],
      );
      itShouldScore(
        'foo - bar', 'all',
        'bar',
        [],
      );
    });

    describe('expression and', () => {
      itShouldScore(
        'foo + bar', null,
        'foo',
        [],
      );
      itShouldScore(
        'foo + bar', null,
        'bar',
        [],
      );
      itShouldScore(
        'foo + bar', null,
        'foo bar',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['bar'], range: [4, 7] },
        ],
      );
    });

    describe('expression or', () => {
      itShouldScore(
        'foo | bar', null,
        'foo',
        [
          { ngrams: ['foo'], range: [0, 3] },
        ],
      );
      itShouldScore(
        'foo | bar', null,
        'bar',
        [
          { ngrams: ['bar'], range: [0, 3] },
        ],
      );
      itShouldScore(
        'foo | bar', null,
        'foo bar',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['bar'], range: [4, 7] },
        ],
      );
    });

    describe('expression or (implicit)', () => {
      itShouldScore(
        'foo bar', null,
        'foo',
        [
          { ngrams: ['foo'], range: [0, 3] },
        ],
      );
      itShouldScore(
        'foo bar', null,
        'bar',
        [
          { ngrams: ['bar'], range: [0, 3] },
        ],
      );
      itShouldScore(
        'foo bar', null,
        'foo bar',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['bar'], range: [4, 7] },
        ],
      );
    });

    describe('nesting', () => {
      itShouldScore(
        'foo bar biz', null,
        'foo biz',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['biz'], range: [4, 7] },
        ],
      );
      itShouldScore(
        'foo bar biz', null,
        'bar biz',
        [
          { ngrams: ['bar'], range: [0, 3] },
          { ngrams: ['biz'], range: [4, 7] },
        ],
      );
      itShouldScore(
        'foo bar biz', null,
        'foo bar',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['bar'], range: [4, 7] },
        ],
      );
      itShouldScore(
        'foo bar biz', null,
        'foo bar biz',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['bar'], range: [4, 7] },
          { ngrams: ['biz'], range: [8, 11] },
        ],
      );
    });

    describe('grouping', () => {
      itShouldScore(
        '(foo bar) biz', null,
        'foo biz',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['biz'], range: [4, 7] },
        ],
      );
      itShouldScore(
        'foo (bar biz)', null,
        // document is only different to keep tests unique and does not impact test outcome
        'foo bar',
        [
          { ngrams: ['foo'], range: [0, 3] },
          { ngrams: ['bar'], range: [4, 7] },
        ],
      );
    });
  });
});