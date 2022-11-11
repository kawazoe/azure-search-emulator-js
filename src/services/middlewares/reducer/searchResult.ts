import type { ODataSelect, ODataSelectResult } from '../../../lib/odata';
import type { DocumentMiddleware, SearchResult } from '../../searchBackend';

export function useSearchResult<T extends object, Keys extends ODataSelect<T>>(): DocumentMiddleware<T, Keys> {
  return (next) => (acc, cur) => {
    acc.values.push({
      ...cur.selected ?? cur.document.original,
      '@search.score': cur.globalScore,
      '@search.highlights': cur.suggestions,
      '@search.features': cur.features,
    } as unknown as SearchResult<ODataSelectResult<T, Keys>>);

    return next(acc, cur);
  };
}
