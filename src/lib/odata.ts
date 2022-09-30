import { map } from './objects';
import { DeepKeyOf, DeepPick } from './types';

export type ODataSelect<T extends object> = DeepKeyOf<T, '/'>;
export type ODataSelectResult<T extends object, Keys extends string> = DeepPick<T, Keys, '/'>;

export function toODataQuery(query: Record<string, unknown>) {
  const converted = {
    ...query,
    ...(query.count ? { '$count': query.count } : {}),
    ...(query.filter ? { '$filter': query.filter } : {}),
    ...(query.orderby ? { '$orderby': query.orderby } : {}),
    ...(query.select ? { '$select': query.select } : {}),
    ...(query.skip ? { '$skip': query.skip } : {}),
    ...(query.top ? { '$top': query.top } : {}),
  };

  return new URLSearchParams(map(converted, ([k, v]) => [k, `${v}`]))
    .toString();
}
