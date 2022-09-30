export type Join<Key, Prop, Del = '.'> = [Key] extends [never]
  ? `${Prop & (string | number)}`
  : `${Key & (string | number)}${Del & string}${Prop & (string | number)}`;

export type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...0[]];

export type DeepKeyOf<T, Del = '.', Depth extends number = 5> = [Depth] extends [never]
  ? never
  : T extends object
    ? {
      [Key in keyof T]-?: Key extends string | number
        ? T[Key] extends Array<infer ArrayT>
          ? `${Key}` | Join<Key, DeepKeyOf<ArrayT, Del, Prev[Depth]>, Del>
          : `${Key}` | Join<Key, DeepKeyOf<T[Key], Del, Prev[Depth]>, Del>
        : never;
    }[keyof T]
    : never;

const unusedSymbol: unique symbol = Symbol();
export type UNUSED = typeof unusedSymbol;

export type UsedKeys<T> = {
  [Key in keyof T]: StripUnused<T[Key]> extends UNUSED ? never : Key;
}[keyof T];

export type StripUnused<T> = T extends Array<infer ArrayT>
  ? StripUnused<ArrayT> extends UNUSED
    ? never
    : Array<StripUnused<ArrayT>>
  : T extends object
    ? { [Key in keyof T]: StripUnused<T[Key]> }[keyof T] extends UNUSED
      ? never
      : { [UnusedKey in UsedKeys<T>]: StripUnused<T[UnusedKey]> }
    : T;

export type DeepPickInner<
  T,
  Prop extends string,
  Del = '.',
  Depth extends number = 5,
  Path extends string = never,
> = [Depth] extends [never] // max depth reached
  ? UNUSED
  : T extends Array<infer E> // special array handling
    ? Array<DeepPickInner<E, Prop, Del, Prev[Depth], Path>>
    : T extends object
      ? { [K in keyof T]: DeepPickInner<T[K], Prop, Del, Prev[Depth], Join<Path, K, Del>> }
      : [Path & Prop] extends [never] // if T isn't a match
        ? UNUSED
        : T;

// Evaluates to a super-type of T which only contains properties referenced by any paths in Prop,
// down to Depth levels deep from T.
export type DeepPick<T, Prop extends string, Del = '.', Depth extends number = 5> = StripUnused<
  DeepPickInner<T, Prop, Del, Depth>
  > extends UNUSED
  ? {} // when no paths are provided, return an empty object instead of our private symbol
  : StripUnused<DeepPickInner<T, Prop, Del, Depth>>;