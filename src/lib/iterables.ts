export function asIterable<T>(array: T[]): Iterable<T> {
  return array;
}
export function toIterable<K extends PropertyKey, V>(obj: Record<K, V>): Iterable<[string, V]> {
  return Object.entries(obj);
}
export function toArray<T>(source: Iterable<T>): T[] {
  return Array.from(source);
}
export function toRecord<K extends PropertyKey, V>(source: Iterable<[K, V]>): Record<K, V> {
  return Object.fromEntries(source) as Record<K, V>;
}

export function isIterable<T>(source: any): source is Iterable<T> {
  return source != null && typeof source[Symbol.iterator] === 'function';
}

export function identity<T>(source: Iterable<T>): Iterable<T> {
  return source;
}

export function map<T, R>(selector: (value: T, index: number) => R, thisArg?: any) {
  return function *(this: any, source: Iterable<T>): Iterable<R> {
    let index = 0;
    for (const value of source) {
      yield selector.call(thisArg ?? this, value, index++);
    }
  }
}

export function filter<T, S extends T>(predicate: (value: T, index: number) => value is S, thisArg?: any): (source: Iterable<T>) => Iterable<S>;
export function filter<T>(predicate: (value: T, index: number) => unknown, thisArg?: any): (source: Iterable<T>) => Iterable<T>;
export function filter<T, S extends T>(predicate: (value: T, index: number) => unknown, thisArg?: any) {
  return function *(this: any, source: Iterable<T>): Iterable<S> {
    let index = 0;
    for (const value of source) {
      if (predicate.call(thisArg ?? this, value, index++)) {
        yield value as S;
      }
    }
  }
}

export function reduce<T>(callbackfn: (previousValue: T, currentValue: T, currentIndex: number) => T): (source: Iterable<T>) => T;
export function reduce<T>(callbackfn: (previousValue: T, currentValue: T, currentIndex: number) => T, initialValue: T): (source: Iterable<T>) => T;
export function reduce<T, U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): (source: Iterable<T>) => U;
export function reduce<T, U>(
  ...args:
    [(previousValue: T, currentValue: T, currentIndex: number) => T] |
    [(previousValue: T, currentValue: T, currentIndex: number) => T, T] |
    [(previousValue: U, currentValue: T, currentIndex: number) => U, U]
) {
  const [callbackfn, initialValue] = args;
  return function (source: Iterable<T>): T | U | undefined {
    const iterator = source[Symbol.iterator]();
    
    let index = 0;
    let acc = initialValue;

    if (args.length === 1) {
      const first = iterator.next();

      if (first.done) {
        throw new TypeError('Reduce of empty array with no initial value');
      }

      acc = first.value;
      index++;
    }

    for (let cur = iterator.next(); !cur.done; cur = iterator.next()) {
      // @ts-ignore
      acc = callbackfn(acc, cur.value, index++);
    }

    return acc;
  }
}

export function take<T>(count: number) {
  return function *(source: Iterable<T>): Iterable<T>{
    const iterator = source[Symbol.iterator]();
    
    for (let i = 0, cur = iterator.next(); i < count && !cur.done; i++, cur = iterator.next()) {
      yield cur.value;
    }
  }
}

export type Sortable = string | number | Date;
export type SortStrategy<T> = (left: T, right: T) => -1 | 0 | 1;
export function sort<T>(comparer: SortStrategy<T>) {
  return function (source: Iterable<T>): Iterable<T> {
    const results = Array.from(source);
    results.sort(comparer);
    return asIterable(results);
  }
}
function ascendingSortStrategy(l: Sortable, r: Sortable): -1 | 0 | 1 {
  return l < r ? -1 : l > r ? 1 : 0;
}
function descendingSortStrategy(l: Sortable, r: Sortable): -1 | 0 | 1 {
  return l < r ? 1 : l > r ? -1 : 0;
}
export function sortBy<T>(selector: (value: T) => Sortable, strategy: SortStrategy<Sortable> = sortBy.asc) {
  return sort<T>((left, right) => {
    return strategy(selector(left), selector(right));
  });
}
sortBy.asc = ascendingSortStrategy;
sortBy.desc = descendingSortStrategy;

export function groupBy<T, K>(keySelector: (value: T) => K): (source: Iterable<T>) => Iterable<{ key: K, results: Iterable<T> }>;
export function groupBy<T, K, R>(keySelector: (value: T) => K, resultSelector: (value: T) => R): (source: Iterable<T>) => Iterable<{ key: K, results: Iterable<R> }>
export function groupBy<T, K, R>(keySelector: (value: T) => K, resultSelector?: (value: T) => R) {
  return reduce(
    (acc, cur: T) => {
      const key = keySelector(cur);

      let group = acc.find(g => g.key === key);
      if (!group) {
        group = { key, results: [] };
        acc.push(group);
      }

      group.results.push(resultSelector ? resultSelector(cur) : cur as unknown as R);

      return acc;
    },
    [] as { key: K, results: R[] }[],
  );
}

export function uniq<T>(): (source: Iterable<T>) => Iterable<T>;
export function uniq<T, K>(keySelector: (value: T) => K): (source: Iterable<T>) => Iterable<T>;
export function uniq<T, K>(keySelector?: (value: T) => K): (source: Iterable<T>) => Iterable<T> {
  if (!keySelector) {
    return function (source: Iterable<T>) {
      return new Set(source);
    }
  }

  return function *(source: Iterable<T>): Iterable<T> {
    const sentinel = new Set<K | T>();

    for (const value of source) {
      const key = keySelector(value);

      const previousSize = sentinel.size;
      sentinel.add(key);

      if (previousSize !== sentinel.size) {
        yield value;
      }
    }
  }
}

export function *flatten<T>(source: Iterable<Iterable<T>>): Iterable<T> {
  for (const value of source) {
    for (const sub of value) {
      yield sub;
    }
  }
}

export function sum(source: Iterable<number>): number {
  let acc = 0;
  for (const n of source) {
    acc += n;
  }
  return acc;
}

export function any<T>(predicate?: (value: T) => boolean): (source: Iterable<T>) => boolean {
  return function (source: Iterable<T>): boolean {
    for (const value of source) {
      if (!predicate || predicate(value)) {
        return true;
      }
    }

    return false;
  }
}