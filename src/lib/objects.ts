export function map<T extends {}, R = Record<PropertyKey, unknown>>(obj: T, selector: <K extends keyof T, V = T[K]>([k, v]: [K, V]) => any): R {
  return Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => selector([k as keyof T, v]))
  ) as R;
}

export function getValue(input: any, [first, ...rest]: string[]): unknown {
  if (first == null) {
    throw new Error('Invalid operation. Second parameter requires at least one value.');
  }

  return rest.length
    ? Array.isArray(input[first])
      ? input[first].map((v: any) => getValue(v, rest))
      : getValue(input[first], rest)
    : input[first];
}
export function getStruct(input: any, [first, ...rest]: string[]): unknown {
  if (first == null) {
    throw new Error('Invalid operation. Second parameter requires at least one value.');
  }

  return {
    [first]: rest.length
      ? Array.isArray(input[first])
        ? input[first].map((v: any) => getStruct(v, rest))
        : getStruct(input[first], rest)
      : input[first]
  };
}