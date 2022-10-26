import { pipe } from '../lib/functions';
import { flatten, map, toArray } from '../lib/iterables';

/**
 * When handling data from documents, we can look through:
 * string,
 * string collections,
 * or collections of objects (recursively) with string or a string collection leaf.
 *
 * This function converts any of those data sources to the same format.
 * @param value
 */
export function normalizeValue(value: unknown): string[] {
  function _normalizeValue(val: unknown) {
    return Array.isArray(val)
      ? pipe(
        val as unknown[],
        map(c => normalizeValue(c)),
        flatten,
      )
      : [`${val}`]
  }

  return toArray(_normalizeValue(value));
}