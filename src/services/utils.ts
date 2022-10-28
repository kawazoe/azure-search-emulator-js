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
      ? (val as unknown[]).flatMap(c => normalizeValue(c))
      : [`${val}`]
  }

  return Array.from(_normalizeValue(value));
}