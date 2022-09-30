export function toIterator<T>(array: T[]): IterableIterator<T>;
export function toIterator<K extends PropertyKey, V>(obj: Record<K, V>): IterableIterator<[string, V]>;
export function toIterator<T, K extends PropertyKey, V>(source: T[] | Record<K, V>): IterableIterator<T> | IterableIterator<[string, V]> {
  const collection: T[] | [string, V][] = Array.isArray(source)
    ? source
    : Object.entries(source);
  return collection[Symbol.iterator]();
}
export function toArray<T>(source: IterableIterator<T>): T[] {
  return Array.from(source);
}
export function toRecord<K extends PropertyKey, V>(source: IterableIterator<[K, V]>): Record<K, V> {
  return Object.fromEntries(source) as Record<K, V>;
}

export function map<T, R>(selector: (value: T, index: number) => R, thisArg?: any) {
  return function *(this: any, source: IterableIterator<T>): IterableIterator<R> {
    let index = 0;
    for (const value of source) {
      yield selector.call(thisArg ?? this, value, index++);
    }
  }
}

export function filter<T>(predicate: (value: T, index: number) => unknown, thisArg?: any): (source: IterableIterator<T>) => IterableIterator<T>;
export function filter<T, S extends T>(predicate: (value: T, index: number) => value is S, thisArg?: any): (source: IterableIterator<T>) => IterableIterator<S>;
export function filter<T, S extends T>(predicate: (value: T, index: number) => unknown, thisArg?: any) {
  return function *(this: any, source: IterableIterator<T>): IterableIterator<S> {
    let index = 0;
    for (const value of source) {
      if (predicate.call(thisArg ?? this, value, index++)) {
        yield value as S;
      }
    }
  }
}

export function reduce<T>(callbackfn: (previousValue: T, currentValue: T, currentIndex: number) => T): (source: IterableIterator<T>) => T;
export function reduce<T>(callbackfn: (previousValue: T, currentValue: T, currentIndex: number) => T, initialValue: T): (source: IterableIterator<T>) => T;
export function reduce<T, R>(callbackfn: (previousValue: T, currentValue: T, currentIndex: number) => T, initialValue: T, resultSelector: (accumulator: T) => R): (source: IterableIterator<T>) => R;
export function reduce<T, U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): (source: IterableIterator<T>) => U;
export function reduce<T, U, R = U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U, resultSelector: (accumulator: U) => R): (source: IterableIterator<T>) => R;
export function reduce<T, U, R = U>(
  ...args:
    [(previousValue: T, currentValue: T, currentIndex: number) => T] |
    [(previousValue: T, currentValue: T, currentIndex: number) => T, T] |
    [(previousValue: T, currentValue: T, currentIndex: number) => T, T, (accumulator: T) => R] |
    [(previousValue: U, currentValue: T, currentIndex: number) => U, U] |
    [(previousValue: U, currentValue: T, currentIndex: number) => U, U, (accumulator: U) => R]
) {
  const [callbackfn, initialValue, resultSelector] = args;
  return function (source: IterableIterator<T>): T | U | R | undefined {
    let index = 0;
    let acc = initialValue;

    if (args.length === 1) {
      const first = source.next();

      if (first.done) {
        throw new TypeError('Reduce of empty array with no initial value');
      }

      acc = first.value;
      index++;
    }

    for (const value of source) {
      // @ts-ignore
      acc = callbackfn(acc, value, index++);
    }

    // @ts-ignore
    return resultSelector ? resultSelector(acc) : acc;
  }
}

export function take<T>(count: number) {
  return function *(source: IterableIterator<T>): IterableIterator<T>{
    for (let i = 0, cur = source.next(); i < count && !cur.done; i++, cur = source.next()) {
      yield cur.value;
    }
  }
}

export function sort<T>(comparer: (left: T, right: T) => -1 | 0 | 1) {
  return function (source: IterableIterator<T>): IterableIterator<T> {
    const results = Array.from(source);
    results.sort(comparer);
    return toIterator(results);
  }
}

export function identity<T>(source: IterableIterator<T>): IterableIterator<T> {
  return source;
}

export function *flatten<T>(source: IterableIterator<IterableIterator<T>>): IterableIterator<T> {
  for (const value of source) {
    for (const sub of value) {
      yield sub;
    }
  }
}

export function sum(source: IterableIterator<number>): number {
  let acc = 0;
  for (const n of source) {
    acc += n;
  }
  return acc;
}