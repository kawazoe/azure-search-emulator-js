import type { ODataSelect, ODataSelectResult } from '../../../lib/odata';
import { sortBy } from '../../../lib/iterables';

import type { DocumentMiddleware, SuggestResult } from '../../searchBackend';

export function useSuggestResult<T extends object, Keys extends ODataSelect<T>>(): DocumentMiddleware<T, Keys> {
  return (next) => (acc, cur) => {
    const suggestions = Object.entries(cur.suggestions)
      .sort(sortBy(([key]) => cur.features[key].similarityScore, sortBy.desc))
      .flatMap(([, suggestions]) => suggestions
        .map((s) => ({
          '@search.score': cur.globalScore,
          '@search.text': `${s}`,
          ...cur.selected ?? cur.document.original,
        } as SuggestResult<ODataSelectResult<T, Keys>>)),
      );

    acc.values.push(...suggestions);

    return next(acc, cur);
  };
}