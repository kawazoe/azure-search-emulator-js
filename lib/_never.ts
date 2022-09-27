/**
 * Expression compatible equivalent of the "never" keyword.
 * @param dummy A dummy value used for strongly typed error validation, like the default of a switch.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function _never(dummy: never): never {
  throw new Error('Unexpected logic case.');
}
