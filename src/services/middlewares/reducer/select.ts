import type { ODataSelect, ODataSelectResult } from '../../../lib/odata';

import type { DocumentMiddleware } from '../../searchBackend';
import * as Parsers from '../../../parsers';

export function useSelect<T extends object, Keys extends ODataSelect<T>>(select: Keys[]): DocumentMiddleware<T, Keys> {
  return (next, schemaService) => {
    const selectCommand = Parsers.select.parse(select.join(', '));
    schemaService.assertCommands({selectCommand});

    return (acc, cur) => {
      cur.selected = selectCommand.apply(cur.document.original) as ODataSelectResult<T, Keys>;

      return next(acc, cur);
    };
  };
}