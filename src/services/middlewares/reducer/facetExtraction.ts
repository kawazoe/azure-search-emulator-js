import type { ODataSelect } from '../../../lib/odata';

import type { DocumentMiddleware } from '../../searchBackend';
import * as Parsers from '../../../parsers';

export function useFacetExtraction<T extends object, Keys extends ODataSelect<T>>(facets: string[]): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const facetCommands = facets.map(f => Parsers.facet.parse(f));
    schemaService.assertCommands({facetCommands});

    return (acc, cur) => {
      for (const command of facetCommands) {
        acc.facets = command.apply(acc.facets, cur.document.original);
      }

      return next(acc, cur);
    };
  };
}