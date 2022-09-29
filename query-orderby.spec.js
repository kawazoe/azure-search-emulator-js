import { orderBy as parser } from './dist/azure-search-emulator.es.js';

console.log('describe query-orderby apply');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;
function testApply(raw, source, target) {
  const pad = (str, c, max) => str + (c.repeat(max).substring(0, max - str.length));
  const message = (kind, ...rest) => console[kind](pad(`It should apply "${raw}"`, ' ', 60), ...rest);

  try {
    const ast = parser.parse(raw);
    const actual = JSON.stringify(source.sort(ast.apply));
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
  'foo',
  [ { foo: 3 }, { foo: 1 }, { foo: 2 } ],
  [ { foo: 1 }, { foo: 2 }, { foo: 3 } ],
);
testApply(
  'foo asc',
  [ { foo: 3 }, { foo: 1 }, { foo: 2 } ],
  [ { foo: 1 }, { foo: 2 }, { foo: 3 } ],
);
testApply(
  'foo',
  [ { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 1, foo: 2 } ],
  [ { bar: 1, foo: 1 }, { bar: 1, foo: 2 }, { bar: 1, foo: 3 } ],
);
testApply(
  'bar',
  [ { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 1, foo: 2 } ],
  [ { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 1, foo: 2 } ],
);
testApply(
  'foo, bar',
  [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
  [ { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 }, { bar: 1, foo: 3 }, { bar: 2, foo: 3 } ],
);
testApply(
  'foo asc, bar asc',
  [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
  [ { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 }, { bar: 1, foo: 3 }, { bar: 2, foo: 3 } ],
);
testApply(
  'foo desc',
  [ { foo: 3 }, { foo: 1 }, { foo: 2 } ],
  [ { foo: 3 }, { foo: 2 }, { foo: 1 } ],
);
testApply(
  'foo desc',
  [ { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 1, foo: 2 } ],
  [ { bar: 1, foo: 3 }, { bar: 1, foo: 2 }, { bar: 1, foo: 1 } ],
);
testApply(
  'foo desc, bar',
  [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
  [ { bar: 1, foo: 3 }, { bar: 2, foo: 3 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 }, { bar: 1, foo: 1 } ],
);
testApply(
  'foo, bar desc',
  [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
  [ { bar: 1, foo: 1 }, { bar: 4, foo: 2 }, { bar: 2, foo: 2 }, { bar: 2, foo: 3 }, { bar: 1, foo: 3 } ],
);
testApply(
  'foo asc, bar desc',
  [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
  [ { bar: 1, foo: 1 }, { bar: 4, foo: 2 }, { bar: 2, foo: 2 }, { bar: 2, foo: 3 }, { bar: 1, foo: 3 } ],
);
testApply(
  'foo desc, bar desc',
  [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 1, foo: 1 }, { bar: 2, foo: 2 }, { bar: 4, foo: 2 } ],
  [ { bar: 2, foo: 3 }, { bar: 1, foo: 3 }, { bar: 4, foo: 2 }, { bar: 2, foo: 2 }, { bar: 1, foo: 1 } ],
);
testApply(
  'search.score()',
  [ { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 }, { '@search.score': 1, foo: 2 } ],
  [ { '@search.score': 1, foo: 2 }, { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 } ],
);
testApply(
  'search.score() asc',
  [ { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 }, { '@search.score': 1, foo: 2 } ],
  [ { '@search.score': 1, foo: 2 }, { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 } ],
);
testApply(
  'search.score() desc',
  [ { '@search.score': 2, foo: 3 }, { '@search.score': 3, foo: 1 }, { '@search.score': 1, foo: 2 } ],
  [ { '@search.score': 3, foo: 1 }, { '@search.score': 2, foo: 3 }, { '@search.score': 1, foo: 2 } ],
);

console.log('='.repeat(70));
console.info('Passed:', passed, 'Failed:', failed);
