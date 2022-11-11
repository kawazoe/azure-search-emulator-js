import type { ODataSelect } from '../../../lib/odata';

import * as Parsers from '../../../parsers';
import type { ResultsMiddleware } from '../../searchBackend';

export function useOrderBy<T extends object, Keys extends ODataSelect<T>>(orderBy: string): ResultsMiddleware<T, Keys> {
  return (next, schemaService) => {
    const orderByCommand = Parsers.orderBy.parse(orderBy);
    schemaService.assertCommands({ orderByCommand });

    return (reduction, results) => {
      reduction.values.sort(orderByCommand.apply);

      return next(reduction, results);
    };
  };
}