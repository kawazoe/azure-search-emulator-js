import type { ODataSelect } from '../../../lib/odata';

import type { ResultsMiddleware } from '../../searchBackend';

export function useStripScore<T extends object, Keys extends ODataSelect<T>>(): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      const strippedValue: typeof results.value = [];
      for (const {['@search.score']: score, ...rest} of results.value as any[]) {
        strippedValue.push(rest);
      }
      results.value = strippedValue;

      return next(reduction, results);
    };
  };
}