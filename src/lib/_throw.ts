/**
 * Expression compatible equivalent of the "throw" keyword.
 * @param error The error to throw. Can be provided as a factory function.
 */
export function _throw(error: unknown | (() => unknown)): never {
  throw typeof error === 'function' ? error() : error;
}
