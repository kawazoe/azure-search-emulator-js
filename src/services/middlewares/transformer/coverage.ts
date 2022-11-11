import type { ODataSelect } from '../../../lib/odata';

import type { ResultsMiddleware } from '../../searchBackend';

export function useCoverage<T extends object, Keys extends ODataSelect<T>>(): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      results['@search.coverage'] = 100;

      return next(reduction, results);
    };
  };
}