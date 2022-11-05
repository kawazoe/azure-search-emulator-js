import {
  AutocompleteEngine,
  SchemaService,
  Scorer,
  SearchBackend,
  SearchEngine,
  SuggestEngine
} from '../dist/azure-search-emulator.es.js';

// Tooling
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function _throw(error) {
  throw error;
}

function render(strings, ...args) {
  let result = '';

  const max = Math.max(strings.length, args.length);
  for (let i = 0; i < max; i++){
    const arg = args[i] ?? '';
    const str = strings[i] ?? '';

    result += str;

    if (typeof arg === 'number') {
      result += Math.round(arg * 100) / 100;
    } else {
      result += arg;
    }
  }

  return result;
}

function groupBy(set, keySelector, resultSelector) {
  return set.reduce(
    (acc, cur) => {
      const key = keySelector(cur);

      let group = acc.find(g => g.key === key);
      if (!group) {
        group = { key, results: [] };
        acc.push(group);
      }

      group.results.push(resultSelector ? resultSelector(cur) : cur);

      return acc;
    },
    [],
  )
}

function continuousMode(set, keySelector, targetDeviation, precision) {
  const _rec = (p) => {
    const groups = groupBy(set, v => keySelector(v, p));

    if ((groups.length / set.length) > 1 / targetDeviation) {
      return _rec(p - 1);
    }

    groups.sort(({results: l}, {results: r}) => l.length > r.length ? -1 : l.length < r.length ? 1 : 0);

    const [first, second] = groups;

    if (!second || first.results.length !== second.results.length) {
      return first.key;
    }

    return _rec(p - 1);
  };

  return _rec(precision);
}

function hydrateParsedProxies(document) {
  for (const key in document) {
    const target = document[key];

    if (target.kind === 'text') {
      // noinspection BadExpressionStatementJS
      target.normalized?.length;
      // noinspection BadExpressionStatementJS
      target.words?.length;
    }
    if (target.kind === 'geo') {
      // noinspection BadExpressionStatementJS
      target.points?.length;
    }
    if (target.kind === 'generic') {
      // noinspection BadExpressionStatementJS
      target.normalized?.length;
    }
  }
}

const tasks = [];
let runner = null;
function _deferedRun() {
  if (runner) {
    return;
  }

  runner = setTimeout(() => {
    const onlyMode = tasks.find(t => t.only);

    const effectiveTasks = onlyMode
      ? tasks.filter(t => t.kind !== 'bench' || t.only)
      : tasks;

    for (const task of effectiveTasks) {
      task.fn();
    }
  });
}

function describe(name, fn) {
  tasks.push({ kind: 'describe', fn: () => console.group('describe', name) });
  fn();
  tasks.push({ kind: 'describe', fn: () => console.groupEnd() });
  _deferedRun();
}
function beforeAll(fn) {
  tasks.push({ kind: 'beforeAll', fn });
  _deferedRun();
}
function bench(name, fn, { warmupIterations, iterations, sigma } = { warmupIterations: 5, iterations: 100, sigma: 3 }) {
  tasks.push({ kind: 'bench', fn: () => {
    console.info('bench', name);

    for (let i = 0; i < warmupIterations; i++) {
      fn();
    }

    const runs = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const stop = performance.now();

      runs.push(stop - start);
    }

    runs.sort();

    const total = runs.reduce((a, c) => a + c);
    const mean = runs.length > 0 ? total / runs.length : 0;
    const min = runs[0] ?? 0;
    const max = runs[runs.length - 1] ?? 0;

    const standardDeviation = Math.sqrt( runs.reduce((a, c) => (c - mean) ** 2) / runs.length);

    const samples = runs.filter(r => Math.abs(mean - r) <= sigma * standardDeviation);
    const sMin = samples[0] ?? 0;
    const sMax = samples[samples.length - 1] ?? 0;
    const sRange = sMax - sMin;

  const mode = continuousMode(samples, (s, d) => Math.round(s * (10 ** d)) / (10 ** d), 0.5 * sigma, 5);
    
    console.info(render`=> total: ${total}ms | samples/runs: ${samples.length}/${runs.length} | ops/sec: ${1000 / mean} ±${sRange / 2}ms @ ${sigma}σ`);
    console.info(render`   mean: ${mean}ms | mode: ${mode}ms | min: ${min}ms/${sMin}ms | max: ${sMax}ms/${max}ms`);
  }});

  _deferedRun();
}
bench.only = (name, fn, options) => {
  bench(name, fn, options);
  tasks[tasks.length - 1].only = true;
};

// Dependencies
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const schemaService = SchemaService.createSchemaService([
  { type: 'Edm.String', key: true, name: 'id' },
  { type: 'Edm.String', name: 'fullName' },
]);
const suggesters = [
  {
    name: 'sg',
    searchMode: 'analyzingInfixMatching',
    fields: schemaService.fullSchema
      .filter(([,v]) => v.type === 'Edm.String' || v.type === 'Collection(Edm.String)')
      .map(([k]) => k)
  }
];
const suggesterProvider = name => suggesters.find(s => s.name === name) ?? _throw(new Error(`Unknown suggester ${name}`));

function peopleToStoredDocument(document) {
  return {
    key: document.id,
    original: document,
    parsed: schemaService.parseDocument(document),
  };
}

function createLargeDataSet() {
  return Array.from(new Array(1234))
    .map((_, i) => {
      const doc = peopleToStoredDocument({ id: `${i}`, fullName: `${i}` });
      hydrateParsedProxies(doc.parsed);
      return doc;
    });
}

function createSearchEngine() {
  const documents = createLargeDataSet();

  return new SearchEngine(
    new SearchBackend(schemaService, () => documents),
    new Scorer([], null)
  );
}

function createSuggestEngine() {
  const documents = createLargeDataSet();

  return new SuggestEngine(
    new SearchBackend(
      schemaService,
        () => documents
    ),
    () => schemaService.keyField,
    suggesterProvider,
  );
}

function createAutocompleteEngine() {
  const documents = createLargeDataSet();

  return new AutocompleteEngine(
    new SearchBackend(
      schemaService,
        () => documents
    ),
    suggesterProvider,
  );
}

// Tests
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
describe('SearchEngine', () => {
  let sut;
  beforeAll(() => sut = createSearchEngine());

  bench('large query', () => {
    sut.search({ search: '[13579]', top: Number.MAX_SAFE_INTEGER });
  });
});

describe('SuggestEngine', () => {
  let sut;
  beforeAll(() => sut = createSuggestEngine());

  bench('large query', () => {
    sut.suggest({ search: '[13579]', suggesterName: 'sg', top: Number.MAX_SAFE_INTEGER });
  });
});

describe('AutocompleteEngine', () => {
  let sut;
  beforeAll(() => sut = createAutocompleteEngine());

  bench('large query', () => {
    sut.autocomplete({ search: '[13579]', suggesterName: 'sg', top: Number.MAX_SAFE_INTEGER });
  });
});