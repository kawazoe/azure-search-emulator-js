# azure-search-emulator-js
An unofficial javascript emulator for the
[Microsoft Azure Cognitive Search](https://azure.microsoft.com/en-us/products/cognitive-services/#overview) API.

This emulator aims to provide a fast search engine, completely written in javascript, that can run in your browser or
on the server, while matching the Microsoft Azure Cognitive Search API as closely as possible.

## Installation
NPM: `npm i azure-search-emulator-js`

## Usage
Import the emulator, create an index, and start to make queries. You can look at the following example, and refer
yourself to the tests and the [official API documentation](https://learn.microsoft.com/en-us/rest/api/searchservice/)
for more.

```typescript
// Import what you need from the package.
import { Emulator, Schema, Suggester, type GeoJSONPoint } from 'azure-search-emulator-js';

// You can use types to improve typings.
type People = {
  id: string,
  fullName: string,
  phones: string[],
  addresses: {
    parts: string,
    city: string,
    state: string,
    country: string,
    kind: 'home' | 'work',
    geo: GeoJSONPoint,
    order: number,
  }[],
};

// Define a schema that matches the documents you want to store.
const peopleSchema: Schema = [
  { type: 'Edm.String', key: true, name: 'id', facetable: false },
  { type: 'Edm.String', name: 'fullName', facetable: false },
  { type: 'Collection(Edm.String)', name: 'phones', facetable: false },
  {
    type: 'Collection(Edm.ComplexType)', name: 'addresses', fields: [
      { type: 'Edm.String', name: 'parts', facetable: false },
      { type: 'Edm.String', name: 'city' },
      { type: 'Edm.String', name: 'state' },
      { type: 'Edm.String', name: 'country' },
      { type: 'Edm.String', name: 'kind' },
      { type: 'Edm.GeographyPoint', name: 'geo' },
      { type: 'Edm.Int32', name: 'order', facetable: false },
    ]
  },
];

// Define suggesters configurations. (optional)
const peopleSuggesters: Suggester[] = [
  {
    name: 'sg',
    searchMode: 'analyzingInfixMatching',
    fields: 'addresses/city, addresses/state, addresses/country',
  },
];

// Define scoring profiles. (optional)
const peopleScoringProfiles: ScoringProfile<People> = [
  {
    name: 'plain',
    text: {
      weights: {
        id: 15,
        fullName: 10,
      },
    },
  },
  {
    name: 'nearby',
    functions: [
      {
        type: 'magnitude',
        fieldName: 'addresses/order',
        boost: 2,
        magnitude: {
          boostingRangeStart: 3,
          boostingRangeEnd: 0,
        },
        interpolation: 'quadratic',
      },
      {
        type: 'tag',
        fieldName: 'addresses/kind',
        boost: 3,
        tag: {
          tagsParameter: 'kind',
        },
        interpolation: 'constant',
      },
      {
        type: 'distance',
        fieldName: 'addresses/geo',
        boost: 2,
        distance: {
          referencePointParameter: 'me',
          boostingDistance: 75,
        },
      },
      {
        type: 'distance',
        fieldName: 'addresses/geo',
        boost: 5,
        distance: {
          referencePointParameter: 'me',
          boostingDistance: 5,
        },
        interpolation: 'logarithmic'
      },
    ],
  },
]

// Create an instance of the Azure Cognitive Search Emulator.
const emulator = new Emulator();

// Create your index using your configurations.
const peopleIndex = emulator.createIndex<People>({
  name: 'people', 
  schema: peopleSchema, 
  suggesters: peopleSuggesters, 
  scoringProfiles: peopleScoringProfiles,
  defaultScoringProfile: 'plain',
});

// Populate your index with documents.
peopleIndex.postDocuments({
  value: [
    {
      '@search.action': 'upload',
      id: '1',
      fullName: 'Bob Mutton',
      phones: ['555-5550'],
      addresses: [
        {
          parts: '42 somewhere rd',
          city: 'TownsVille',
          country: 'United States',
          kind: 'work',
          geo: { type: 'Point', coordinates: [36.4945867, -78.4323851] },
        },
        {
          parts: '1 righthere drv',
          city: 'Metropolis',
          country: 'Japan',
          geo: { type: 'Point', coordinates: [35.669496, 137.4239011] },
        }
      ]
    },
    // ...
  ]
});

// Query your index.
const results = peopleIndex.search({
  search: '[Bb]ob',
  select: ['id'],
  filter: "addresses/kind eq 'work'",
  count: true,
  facets: ['addresses/city', 'addresses/country'],
});
// {
//   '@search.count': 32,
//   '@search.facets': {
//     'addresses/city': [
//       { value: 'TownsVille', count: 3 },
//       { value: 'Metropolis', count: 12 },
//       ...
//     ],
//     'addresses/country': [
//       { value: 'United States', count: 18 },
//       { value: 'Japan', count: 6 },
//       ...
//     ],
//   },
//   value: [
//     {
//       '@search.score': 30,
//       id: '1',
//     },
//     ...
//   ]
// }
```

## What works
Currently, the emulator supports search, suggest, autocomplete, count, and all data edition operations. You can expect
full odata query support for all queries that uses them. This means $filter, $select, $orderby, $skip, $top, $count, as
well as continuation tokens should work as intended. Search scoring, highlights, features, and facets are supported but
might behave differently from the real service as they depend on full text search statistics. Scoring profiles are also
fully supported but might yield different results from the actual service.

The emulator does schema validation through the use of strong typings and runtime validations. It is expected that the
schema you use to create an index in the emulator should work without any modification when creating a real index in
Azure.

Keep in mind that this is still an early prototype and is not designed to be used in production.

## What does not work
The emulator does not use a full text search engine as its backend. Instead, queries are built around regex text
matching. This means that any query using the Lucene syntax, or features meant to control this syntax (like simple vs
full query types) is not supported. This also means that suggesters, analysers and skillsets are not supported or
extremely limited.

It does not support synonyms.

It does not support sharding, meaning that index coverage will always be 100%.

It does not support encryption.

Do not expect search results from this emulator to match actual search results. They should make sense, but will not,
and probably will never be, the same.

## What is desperately needed
While there are a fair amount of tests, coverage is pretty poor, and there is no visual demo.

This emulator should become a drop in replacement for the real service. Notably, the official javascript search client
should be able to use any of the supported features of the emulator without crashing. Ideally, there should be an
integration with http mocking libraries like MirageJs to use an in-browser emulator with the official client.

Documentation. Currently, people wanting to use this library are expected to know how to use the Microsoft Azure
Cognitive Search API. Official documentation at: https://learn.microsoft.com/en-us/rest/api/searchservice/

## Why?!
Azure Cognitive Search is crazy expensive for single developer projects, specially in their early stages, and provides
a unique API with OData features that you cannot really find with competitors. It would be very difficult to start a
project with a competitor and switch to Azure Cognitive Search later down the line. With an emulator like this one,
you can build your whole application, all the way to RC, and switch to the official service when you feel ready to take
the next step and grow your user base.

For larger projects, you might find it useful to run your entire front-end without any dependencies since some
circumstances like public demos. This project has been designed with MirageJs in mind and will eventually offer a full
API interceptor that is compatible with the official Azure Search javascript client library. This is now one less
service to spin up on your dev machine when testing, or demoing, your application.

## What's next
- Validation against queries made by the official client.
- Support storing/loading the index to/from disk when running on the server.
- Switch the backend to a full text search engine with Lucene syntax.
- Shard data across multiple workers (multi-threaded queries).
- Maybe more features?

## Benchmarks
```
describe SearchEngine
    bench large query
    => total: 2234.81ms | samples/runs: 93/100 | ops/sec: 44.75 ±4.72ms @ 3σ
       mean: 22.35ms | mode: 20ms | min: 18.13ms/18.13ms | max: 27.58ms/45.75ms
describe SuggestEngine
    bench large query
    => total: 1688.16ms | samples/runs: 93/100 | ops/sec: 59.24 ±1.81ms @ 3σ
       mean: 16.88ms | mode: 16.4ms | min: 15.13ms/15.13ms | max: 18.74ms/23.54ms
describe AutocompleteEngine
    bench large query
    => total: 1427.3ms | samples/runs: 94/100 | ops/sec: 70.06 ±1.15ms @ 3σ
       mean: 14.27ms | mode: 14.3ms | min: 13.05ms/13.05ms | max: 15.35ms/18.99ms
```

### Hardware
```
Garuda Linux
Kernel Version: 6.0.6-zen1-1-zen (64-bit)
Processors: 32 x Intel Xeon CPU E5-2687W v2 @3.4GHz
Memory: 64 GB of DDR3-1866 ECC
```

While the code does not yet make use of workers, it is planned to shard the data across multiple workers to improve
performance in the future, so the exact hardware configuration might be valuable.