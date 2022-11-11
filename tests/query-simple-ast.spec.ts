import { describe, expect, it } from 'vitest';

import {
  AstExpression,
  AstPartial,
  AstPhrase,
  AstQuote,
  AstWord,
  simple as parser,
  SimpleAst,
  SimpleParserResult
} from '../src/parsers';

describe('query-select', () => {
  describe('apply', () => {
    function isPojo(candidate: any) {
      return candidate != null && typeof candidate === 'object' && candidate.__proto__.constructor.name === 'Object';
    }
    function stripCompiledDeep({ analyze, ...rest }: SimpleParserResult) {
      const candidate = rest as Record<string, any>;

      for (const k in candidate) {
        if (!candidate.hasOwnProperty(k)) {
          break;
        }

        if (Array.isArray(candidate[k])) {
          candidate[k] = candidate[k].map((r: any) => isPojo(r) ? stripCompiledDeep(r as SimpleParserResult) : r);
        } else if (isPojo(candidate[k])) {
          candidate[k] = stripCompiledDeep(candidate[k]);
        }
      }

      return rest as SimpleAst;
    }

    function test(raw: string, expected: SimpleAst) {
      it(`should query ${raw}`, () => {
        const ast = parser.parse(raw, 'any');

        expect(stripCompiledDeep(ast)).to.deep.equal(expected);
      });
    }

    const wordAst = (value: string): AstWord => ({ type: "WORD", value });
    const quoteAst = (value: string): AstQuote => ({ type: "QUOTE", value });
    const partialAst = (value: AstPhrase): AstPartial => ({ type: "PARTIAL", value });
    const expressionAst = (left: AstExpression, op: 'not' | 'and' | 'or', right: AstExpression): AstExpression => ({ type: "EXPRESSION", left, op, right });

    test('', { type: "EMPTY" });

    test('foo', wordAst('foo'));
    test(' foo ', wordAst('foo'));

    test('""', quoteAst(''));
    test('"foo"', quoteAst('foo'));
    test('"+-|*()"', quoteAst('+-|*()'));
    test('" foo "', quoteAst(' foo ',));
    test('" fo\\"o "', quoteAst(' fo"o '));
    test('"foo bar"', quoteAst('foo bar'));
    test('" foo   bar "', quoteAst(' foo   bar '));
    test('" foo \\" bar "', quoteAst(' foo " bar '));

    test("''", quoteAst(''));
    test("'foo'", quoteAst('foo'));
    test("'+-|*()'", quoteAst('+-|*()'));
    test("' foo '", quoteAst(' foo '));
    test("' fo\\'o '", quoteAst(" fo'o "));
    test("'foo bar'", quoteAst('foo bar'));
    test("' foo   bar '", quoteAst(' foo   bar '));
    test("' foo \\' bar '", quoteAst(" foo ' bar "));

    test('foo*', partialAst(wordAst('foo')));
    test(' foo * ', partialAst(wordAst('foo')));
    test('"foo"*', partialAst(quoteAst('foo')));
    test('" foo "* ', partialAst(quoteAst(' foo ')));
    test("'foo'*", partialAst(quoteAst('foo')));
    test("' foo '* ", partialAst(quoteAst(' foo ')));

    test('foo-bar', expressionAst(
      wordAst('foo'),
      'not',
      wordAst('bar'),
    ));
    test('foo+bar', expressionAst(
      wordAst('foo'),
      'and',
      wordAst('bar'),
    ));
    test('foo|bar', expressionAst(
      wordAst('foo'),
      'or',
      wordAst('bar'),
    ));
    test('foo bar', expressionAst(
      wordAst('foo'),
      'or',
      wordAst('bar'),
    ));

    test('foo+bar|biz', expressionAst(
      expressionAst(
        wordAst('foo'),
        'and',
        wordAst('bar'),
      ),
      'or',
      wordAst('biz'),
    ));

    test('foo+(bar|biz)', expressionAst(
      wordAst('foo'),
      'and',
      expressionAst(
        wordAst('bar'),
        'or',
        wordAst('biz'),
      ),
    ));

    test('foo - bar - biz buz', expressionAst(
      expressionAst(
        expressionAst(
          wordAst('foo'),
          'not',
          wordAst('bar'),
        ),
        'not',
        wordAst('biz'),
      ),
      'or',
      wordAst('buz'),
    ));

    test('foo - bar - (biz buz)', expressionAst(
      expressionAst(
        wordAst('foo'),
        'not',
        wordAst('bar'),
      ),
      'not',
      expressionAst(
        wordAst('biz'),
        'or',
        wordAst('buz'),
      ),
    ));
  });
});
