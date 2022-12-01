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
  search: 'bo*',
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
Currently, the emulator supports the following [stable API endpoints](https://learn.microsoft.com/en-us/rest/api/searchservice/):
- Indexes
  - [Create Index](https://learn.microsoft.com/en-us/rest/api/searchservice/create-index)
  - [Get Index](https://learn.microsoft.com/en-us/rest/api/searchservice/get-index)
- Documents
  - [Add, Update, or Delete Documents](https://learn.microsoft.com/en-us/rest/api/searchservice/addupdate-or-delete-documents)
  - [Autocomplete](https://learn.microsoft.com/en-us/rest/api/searchservice/autocomplete)
  - [Count Documents](https://learn.microsoft.com/en-us/rest/api/searchservice/count-documents)
  - [Lookup Document](https://learn.microsoft.com/en-us/rest/api/searchservice/lookup-document)
  - [Search Document](https://learn.microsoft.com/en-us/rest/api/searchservice/search-documents)
  - [Suggestions](https://learn.microsoft.com/en-us/rest/api/searchservice/suggestions)

All [documented OData features](https://learn.microsoft.com/en-us/azure/search/query-odata-filter-orderby-syntax) are supported:
- [$filter](https://learn.microsoft.com/en-us/azure/search/search-query-odata-filter)
- [$select](https://learn.microsoft.com/en-us/azure/search/search-query-odata-select)
- [$orderby](https://learn.microsoft.com/en-us/azure/search/search-query-odata-orderby)
- $skip
- $top
- $count
- [Continuation Tokens](https://learn.microsoft.com/en-us/rest/api/searchservice/search-documents#request-body)
 
Most advanced search capabilities are supported but might behave differently from the real service as they depend on full
text search statistics that aren't calculated in the same manner. They are:
- [Scoring profiles](https://learn.microsoft.com/en-us/azure/search/index-add-scoring-profiles)
- Highlights
- Features
- Facets

The emulator does schema validation through the use of strong typings and runtime validations. It is expected that the
schema you use to create an index in the emulator should work without any modification when creating a real index in
Azure.

Keep in mind that this is still an early prototype and is not designed to be used in production.

## What does not work, yet
The emulator does not use a full text search engine as its backend, yet. This means that while it does support the
Simple Lucene Query Syntax, **it does not support the Full Lucene Query Syntax**.

It does not support custom analyzers.  
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
- Replace the naive search algorithm with a more in-depth analysis to build an actual index.
- Shard data across multiple workers (multi-threaded queries).
- Maybe more features?

## Benchmarks
```
describe SearchEngine
  bench large query
  => total: 2484.45ms | samples/runs: 89/100 | ops/sec: 40.25 ±3.53ms @ 3σ
     mean: 24.84ms | mode: 24.1ms | min: 21.03ms/21.49ms | max: 28.55ms/37.54ms
describe SuggestEngine
  bench large query
  => total: 1587.72ms | samples/runs: 95/100 | ops/sec: 62.98 ±4.65ms @ 3σ
     mean: 15.88ms | mode: 15ms | min: 12.29ms/12.29ms | max: 21.59ms/37.56ms
describe AutocompleteEngine
  bench large query
  => total: 1284.09ms | samples/runs: 97/100 | ops/sec: 77.88 ±2.63ms @ 3σ
     mean: 12.84ms | mode: 11ms | min: 10.13ms/10.13ms | max: 15.4ms/23.59ms
```

### Hardware
```
Garuda Linux
Kernel Version: 6.0.6-zen1-1-zen (64-bit)
Processors: 32 x Intel Xeon CPU E5-2687W v2 @3.4GHz (Single Threaded: @4.0 GHz) (Released in 2013)
Memory: 64 GB of DDR3-1866 ECC
```

While the code does not yet make use of workers, it is planned to shard the data across multiple workers to improve
performance in the future, so the exact hardware configuration might be valuable.