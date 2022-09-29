import { filter as parser } from './dist/azure-search-emulator.es.js';

console.log('describe query-filter apply');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;
function test(raw, source, results) {
    const pad = (str, c, max) => str + (c.repeat(max).substring(0, max - str.length));
    const message = (kind, ...rest) => console[kind](pad(`It should apply "${raw}"`, ' ', 60), ...rest);

    try {
        const ast = parser.parse(raw);
        const actual = JSON.stringify(source.map(d => [ast.apply(d), d]));
        const expected = JSON.stringify(results)

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

test(
  'foo eq 42',
  [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
  [[0, { foo: 41, bar: 42 }], [0, { fo: 42 }], [1, { foo: 42, bar: 41 }]]
)
test(
  'foo eq 42 or bar gt 41',
  [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
  [[1, { foo: 41, bar: 42 }], [0, { fo: 42 }], [1, { foo: 42, bar: 41 }]]
)
test(
  'foo eq 41 or bar gt 41',
  [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
  [[2, { foo: 41, bar: 42 }], [0, { fo: 42 }], [0, { foo: 42, bar: 41 }]]
)
test(
  'foo eq 41 and bar gt 41',
  [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
  [[1, { foo: 41, bar: 42 }], [0, { fo: 42 }], [0, { foo: 42, bar: 41 }]]
)
test(
  'foo eq 41 and (bar gt 41 or fo eq null)',
  [{ foo: 41, bar: 42 }, { fo: 42 }, { foo: 42, bar: 41 }],
  [[2, { foo: 41, bar: 42 }], [0, { fo: 42 }], [0, { foo: 42, bar: 41 }]]
)
test(
  'foo/bar eq 41',
  [{ foo: { bar: 41 }, bar: 42 }, { foo: { bar: 42 }, bar: 41 }],
  [[1, { foo: { bar: 41 }, bar: 42 }], [0, { foo: { bar: 42 }, bar: 41 }]]
)
test(
  "foo/any(v:v eq 'faz')",
  [{ foo: ['fiz', 'faz', 'fuz', 'fir', 'buz' ] }, { foo: ['fiz', 'fuz', 'fir', 'buz' ] }],
  [[1, { foo: ['fiz', 'faz', 'fuz', 'fir', 'buz' ] }], [0, { foo: ['fiz', 'fuz', 'fir', 'buz' ] }]]
)
test(
  "foo/any(v:search.in(v, 'f'))",
  [{ foo: ['fiz', 'faz', 'fuz', 'fir', 'buz' ] }, { foo: ['fiz', 'fuz', 'fir', 'buz' ] }],
  [[4, { foo: ['fiz', 'faz', 'fuz', 'fir', 'buz' ] }], [3, { foo: ['fiz', 'fuz', 'fir', 'buz' ] }]]
)
test(
  "foo/all(v:v eq 0)",
  [{ foo: [0, 0, 0] }, { foo: [0, 1, 0] }],
  [[3, { foo: [0, 0, 0] }], [0, { foo: [0, 1, 0] }]]
)
test(
  "search.ismatchscoring('z', 'foo')",
  [{ foo: 'fiz faz fuz fir buz' }, { foo: 'fiz fuz fir buz' }],
  [[1, { foo: 'fiz faz fuz fir buz' }], [1, { foo: 'fiz fuz fir buz' }]]
)
test(
  "search.ismatchscoring('z', 'foo', 'full', 'any')",
  [{ foo: 'fiz faz fuz fir buz' }, { foo: 'fiz fuz fir buz' }],
  [[4, { foo: 'fiz faz fuz fir buz' }], [3, { foo: 'fiz fuz fir buz' }]]
)
test(
  "search.ismatch('z', 'foo', 'full', 'any')",
  [{ foo: 'fiz faz fuz fir buz' }, { foo: 'fiz fuz fir buz' }],
  [[1, { foo: 'fiz faz fuz fir buz' }], [1, { foo: 'fiz fuz fir buz' }]]
)

console.log('='.repeat(70));
console.info('Passed:', passed, 'Failed:', failed);
