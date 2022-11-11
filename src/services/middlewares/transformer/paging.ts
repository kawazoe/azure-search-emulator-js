import type { ODataSelect } from '../../../lib/odata';
import { toODataQuery } from '../../../lib/odata';

import type { ResultsMiddleware } from '../../searchBackend';

export function usePaging<T extends object, Keys extends ODataSelect<T>>(options: {
  skip: number,
  top: number,
  maxPageSize: number,
  request: unknown
}): ResultsMiddleware<T, Keys> {
  return (next) => {
    return (reduction, results) => {
      const pageSize = Math.min(options.top, options.maxPageSize);
      const page = reduction.values.slice(options.skip, options.skip + pageSize);

      const nextPageRequest = options.top > options.maxPageSize && reduction.values.length > options.skip + pageSize
        ? {
          ...options.request as any,
          skip: options.skip + pageSize,
          top: options.top - pageSize,
        }
        : undefined;

      if (nextPageRequest) {
        results['@search.nextPageParameters'] = nextPageRequest;
        results['@odata.nextLink'] = toODataQuery(nextPageRequest);
      }

      results.value = page;

      return next(reduction, results);
    };
  };
}