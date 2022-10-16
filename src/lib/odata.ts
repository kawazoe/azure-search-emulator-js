import { map } from './objects';
import type { DeepKeyOf, DeepPick } from './types';

export * from './types';
export type ODataSelect<T extends object> = DeepKeyOf<T, '/'> | '*';
export type ODataSelectResult<T extends object, Keys extends string> = DeepPick<T, Keys extends '*' ? DeepKeyOf<T, '/'> : Keys, '/'>;

export function toODataQuery(query: Record<string, unknown>) {
  const { count, filter, orderby, select, skip, top, ...rest } = query;
  const converted = {
    ...rest,
    ...(count ? { '$count': count } : {}),
    ...(filter ? { '$filter': filter } : {}),
    ...(orderby ? { '$orderby': orderby } : {}),
    ...(select ? { '$select': select } : {}),
    ...(skip ? { '$skip': skip } : {}),
    ...(top ? { '$top': top } : {}),
  };

  return new URLSearchParams(map(converted, ([k, v]) => [k, `${v}`]))
    .toString();
}
