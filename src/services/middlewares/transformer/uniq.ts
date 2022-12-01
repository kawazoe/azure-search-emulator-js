import type { ODataSelect } from '../../../lib/odata';

import type { ResultsMiddleware } from '../../searchBackend';
import { uniq } from '../../../lib/iterables';
import { ReductionResults } from '../../searchBackend';

export function useUniq<T extends object, Keys extends ODataSelect<T>, R extends ReductionResults<T>['values'][number]>(
  keySelector: (value: R) => unknown,
): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      reduction.values = uniq(reduction.values as R[], keySelector);

      return next(reduction, results);
    };
  };
}