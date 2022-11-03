import { GeoJSONPoint } from './geoPoints';

/**
 * Accepts a Prop string with an optional Parent string and join them together with a Delimiter in between.
 */
export type Join<Parent, Prop, Delimiter = '.'> = [Parent] extends [never]
  ? `${Prop & (string)}`
  : `${Parent & (string)}${Delimiter & string}${Prop & (string)}`;

/**
 * When indexed with a number, returns a number 1 smaller than the provided index.
 */
export type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...0[]];

/**
 * Similar to the keyof operator, but recursively generate keys by deeply traversing objects and arrays.
 */
export type DeepKeyOf<T, Delimiter = '.', Depth extends number = 5> = [Depth] extends [never]
  ? never
  : T extends object
    ? {
      [Key in keyof T]-?: Key extends string
        ? T[Key] extends Array<infer E>
          ? Key | Join<Key, DeepKeyOf<E, Delimiter, Prev[Depth]>, Delimiter>
          : [T[Key]] extends [Date | GeoJSONPoint]
            ? Key
            : Key | Join<Key, DeepKeyOf<T[Key], Delimiter, Prev[Depth]>, Delimiter>
        : never;
    }[keyof T]
    : never;

/**
 * Similar to the keyof operator, but filters keys that resolves to the never type.
 */
export type KeyofFilterNever<T extends object> = { [Key in keyof T]: T[Key] extends never ? never : Key; }[keyof T];
/**
 * Rebuild the provided type by ignoring keys that resolves to the never type.
 */
export type OmitNever<T extends object> = Pick<T, KeyofFilterNever<T>>;

/**
 * Similar to the Pick type, but processes keys, such as the likes produced by DeepKeyOf, to recursively rebuild the type.
 */
export type DeepPick<
  T,
  Keys extends string,
  Delimiter = '.',
  Parent extends string = never,
  Depth extends number = 5,
> = [Depth] extends [never]
  ? never
  : T extends object
    ? OmitNever<{
      [Key in keyof T]: [Join<Parent, Key, Delimiter> & Keys] extends [never]
        ? T[Key] extends Array<infer E>
          // Dive deeper and flatten results
          ? DeepPick<E, Keys, Delimiter, Join<Parent, Key, Delimiter>, Prev[Depth]> extends never | Record<string | number, never>
            ? never
            : Array<DeepPick<E, Keys, Delimiter, Join<Parent, Key, Delimiter>, Prev[Depth]>>
          : [T[Key]] extends [Date | GeoJSONPoint]
            ? never //< Do not dive in excluded types
            : T[Key] extends object
              // Dive deeper and flatten results
              ? DeepPick<T[Key], Keys, Delimiter, Join<Parent, Key, Delimiter>, Prev[Depth]> extends Record<string | number, never>
                ? never
                : DeepPick<T[Key], Keys, Delimiter, Join<Parent, Key, Delimiter>, Prev[Depth]>
              : never //< No exact Keys match and cannot look further down
        : T[Key]  //< Exact Keys match. Keeping original type, even if deep.
    }>
    : never;
