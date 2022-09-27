import { select as parser } from './dist/azure-search-emulator.es.js';

console.log('describe query-select apply');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;
function testApply(raw, source, target) {
  const pad = (str, c, max) => str + (c.repeat(max).substring(0, max - str.length));
  const message = (kind, ...rest) => console[kind](pad(`It should convert "${raw}"`, ' ', 60), ...rest);

  try {
    const ast = parser.parse(raw);
    const actual = JSON.stringify(ast.apply(source));
    const expected = JSON.stringify(target)

    if (actual === expected) {
      // message('info', 'PASS!');
    } else {
      message('error', `FAILED!\n\nE: ${expected}\nA: ${actual}\n`);
      ++failed;
      return;
    }
  } catch (e) {
    message('error', 'FAILED!\n\n', e, '\n\n');
    ++failed;
    return;
  }

  ++passed;
}

testApply(
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

console.log('='.repeat(70));
console.info('Passed:', passed, 'Failed:', failed);
