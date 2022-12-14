import type { ODataSelect } from '../../../lib/odata';
import { sortBy, uniq } from '../../../lib/iterables';

import type { AutocompleteResult, DocumentMiddleware } from '../../searchBackend';

export function useAutocompleteResult<T extends object, Keys extends ODataSelect<T>>(): DocumentMiddleware<T, Keys> {
  return (next) => (acc, cur) => {
    const suggestions = Object.entries(cur.suggestions)
      .sort(sortBy(([key]) => cur.features[key].similarityScore, sortBy.desc))
      .flatMap(([, suggestions]) => uniq(
        suggestions as AutocompleteResult[],
        r => r.text,
        r => ({ '@search.score': cur.globalScore, ...r }),
      ));

    acc.values.push(...suggestions);

    return next(acc, cur);
  };
}