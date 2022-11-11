import type { ODataSelect } from '../../../lib/odata';

import type { ResultsMiddleware } from '../../searchBackend';

export function useLimiterMiddleware<T extends object, Keys extends ODataSelect<T>>(top: number): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      results.value = reduction.values.slice(0, top);

      return next(reduction, results);
    };
  };
}