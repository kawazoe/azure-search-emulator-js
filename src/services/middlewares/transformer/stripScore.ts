import type { ODataSelect } from '../../../lib/odata';

import type { ResultsMiddleware } from '../../searchBackend';

export function useStripScore<T extends object, Keys extends ODataSelect<T>>(): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      results.value = (results.value as any[]).map(({['@search.score']: score, ...rest}) => rest) as typeof results.value;

      return next(reduction, results);
    };
  };
}