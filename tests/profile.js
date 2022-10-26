import { AutocompleteEngine, SearchEngine, SuggestEngine, SearchBackend, SchemaService } from '../dist/azure-search-emulator.es.js';

// Tooling
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function _throw(error) {
  throw error;
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
function bench(name, fn, { warmupIterations, iterations } = { warmupIterations: 5, iterations: 100 }) {
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

    const total = runs.reduce((a, c) => a + c);
    const average = runs.length > 0 ? total / runs.length : 0;
    console.info('=>', 'total:', total, 'average:', average, 'ops/sec', 1000 / average);
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

function createSearchEngine() {
  const documents = Array.from(new Array(1234))
    .map((_, i) => ({ id: `${i}`, fullName: `${i}` }));

  return new SearchEngine(new SearchBackend(
    schemaService,
    () => documents
  ));
}

function createSuggestEngine() {
  const documents = Array.from(new Array(1234))
    .map((_, i) => ({ id: `${i}`, fullName: `${i}` }));

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
  const documents = Array.from(new Array(1234))
    .map((_, i) => ({ id: `${i}`, fullName: `${i}` }));

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