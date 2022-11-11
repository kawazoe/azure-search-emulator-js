import type { ODataSelect } from '../../../lib/odata';

import type { DocumentMiddleware } from '../../searchBackend';
import * as Parsers from '../../../parsers';

export function useFilterScoring<T extends object, Keys extends ODataSelect<T>>(filter: string): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const filterCommand = Parsers.filter.parse(filter);
    schemaService.assertCommands({filterCommand});

    return (acc, cur) => {
      const score = filterCommand.apply(cur.document.original);

      if (score <= 0) {
        return acc;
      }

      cur.globalScore += score;

      return next(acc, cur);
    };
  }
}