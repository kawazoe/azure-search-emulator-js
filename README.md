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
import { Emulator, Schema, Suggester } from 'azure-search-emulator-js';

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
    order: number,
  }[],
}
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
      { type: 'Edm.Int32', name: 'order', facetable: false },
    ]
  },
];
const peopleSuggesters: Suggester[] = [
  {
    name: 'sg',
    searchMode: 'analyzingInfixMatching',
    fields: 'addresses/city, addresses/state, addresses/country',
  },
]

const emulator = new Emulator();
const peopleIndex = emulator.createIndex<People>('people', peopleSchema, peopleSuggesters);
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
        },
        {
          parts: '1 righthere drv',
          city: 'Metropolis',
          country: 'Japan',
        }
      ]
    },
    // ...
  ]
});

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
//       '@search.score': 3,
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
might behave differently from the real service as they depend on full text search statistics.

The emulator does schema validation through the use of strong typings and runtime validations. It is expected that the
schema you use to create an index in the emulator should work without any modification when creating a real index in
Azure.

Keep in mind that this is still an early prototype and is not designed to be used in production.

## What does not work
The emulator does not use a full text search engine as its backend. Instead, queries are built around regex text
matching. This means that any query using the Lucene syntax, or features meant to control this syntax (like simple vs
full query types) is not supported. This also means that suggesters, analysers and skillsets are not supported or
extremely limited.

It does not support scoring profiles.

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

For larger projects, you might find it useful to run your entire front-end without any dependencies. This project has
been designed with MirageJs in mind and will eventually offer a full API interceptor that is compatible with the official
Azure Search javascript client library. This is now one less service to spin up on your dev machine when testing, or
demoing, your application.

## What's next
- Scoring profiles.
- Validation against queries made by the official client.
- Support storing/loading the index to/from disk when running on the server.
- Switch the backend to a full text search engine with Lucene syntax.
- Maybe more features?
