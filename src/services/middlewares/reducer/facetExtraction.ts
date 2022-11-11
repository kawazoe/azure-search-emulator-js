import type { ODataSelect } from '../../../lib/odata';

import type { DocumentMiddleware } from '../../searchBackend';
import * as Parsers from '../../../parsers';

export function useFacetExtraction<T extends object, Keys extends ODataSelect<T>>(facets: string[]): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const facetCommands = facets.map(f => Parsers.facet.parse(f));
    schemaService.assertCommands({facetCommands});

    return (acc, cur) => {
      acc.facets = facetCommands.reduce((a, c) => c.apply(a, cur.document.original), acc.facets);

      return next(acc, cur);
    };
  };
}