import { GeoJSONPoint } from './geo';

export type UnionToIntersection<U> =
// Distribute members of U into parameter position of a union of functions
  (
    U extends unknown ? (_: U) => unknown : never
    ) extends // Infer the intersection of the members of U as a single intersected parameter type
    (_: infer I) => unknown
    ? I
    : never;

// Types that should not be included in SelectPaths recursion
export type ExcludedODataTypes = Date | GeoJSONPoint;

/**
 * Produces a union of valid Cognitive Search OData $select paths for T
 * using a post-order traversal of the field tree rooted at T.
 */
export type DeepKeyOf<T extends object> = T extends (infer U)[]
  ? // Allow selecting fields only from elements which are objects
  NonNullable<U> extends object
    ? DeepKeyOf<NonNullable<U>>
    : never
  : {
    // Only consider string keys
    [K in Exclude<keyof T, symbol | number>]: NonNullable<T[K]> extends object
      ? NonNullable<T[K]> extends ExcludedODataTypes
        ? // Excluded, so don't recur
        K
        : DeepKeyOf<NonNullable<T[K]>> extends infer NextPaths extends string
          ? // Union this key with all the next paths separated with '/'
          K | `${K}/${NextPaths}`
          : // We didn't infer any nested paths, so just use this key
          K
      : // Not an object, so can't recur
      K;
  }[Exclude<keyof T, symbol | number>];

/**
 * Deeply pick fields of T using valid Cognitive Search OData $select
 * paths.
 */
export type DeepPick<T extends object, Keys extends DeepKeyOf<T>> =
// We're going to get a union of individual interfaces for each field in T that's selected, so convert that to an intersection.
  UnionToIntersection<
    // Paths is a union or single string type, so if it's a union it will be _distributed_ over this conditional.
    // Fortunately, template literal types are not greedy, so we can infer the field name easily.
    Keys extends `${infer FieldName extends Exclude<keyof T, symbol | number>}/${infer RestPaths}`
      ? NonNullable<T[FieldName]> extends object
        ? NonNullable<T[FieldName]> extends Array<infer U extends object>
          ? // Extends clause is necessary to refine the constraint of RestPaths
          RestPaths extends DeepKeyOf<U>
            ? // Narrow the type of every element in the array
            {
              [K in FieldName]: Array<DeepPick<U, RestPaths>> | Extract<T[K], null | undefined>;
            }
            : // Unreachable by construction
            never
          : // Recur :)
          {
            [K in FieldName]: RestPaths extends DeepKeyOf<NonNullable<T[K]>>
            ? DeepPick<NonNullable<T[K]>, RestPaths> | Extract<T[K], null | undefined>
            : // Unreachable by construction
            never;
          }
        : // Unreachable by construction
        never
      : // Otherwise, capture the paths that are simple keys of T itself
      Keys extends keyof T
        ? { [K in Keys]: T[K] }
        : // Unreachable by construction
        never
    > & {
  // This useless intersection actually prevents the TypeScript language server from
  // expanding the definition of SearchPick<T, Paths> in IntelliSense. Since we're
  // sure the type always yields an object, this intersection does not alter the type
  // at all, only the display string of the type.
};