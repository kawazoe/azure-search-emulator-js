import type { ODataSelect } from '../../../lib/odata';

import type { ResultsMiddleware, SearchFacetBase, SearchFacetValue } from '../../searchBackend';

export function useFacetTransformation<T extends object, Keys extends ODataSelect<T>>(): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      const facets: Record<string, SearchFacetBase[]> = {};

      for (const facetsKey in reduction.facets) {
        const facet = reduction.facets[facetsKey];
        facets[facetsKey] = (facet.params.sort
          ? Object.entries(facet.results).sort(facet.params.sort)
          : Object.entries(facet.results))
          .slice(0, facet.params.count)
          // TODO: Add support for ranged facets
          .map(([value, count]) => ({value, count} as SearchFacetValue));
      }

      results['@search.facets'] = facets;

      return next(reduction, results);
    };
  };
}