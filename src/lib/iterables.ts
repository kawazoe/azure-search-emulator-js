export function isIterable<T>(source: any): source is Iterable<T> {
  return source != null && typeof source[Symbol.iterator] === 'function';
}

export type Sortable = string | number | Date;
export type SortStrategy<T> = (left: T, right: T) => -1 | 0 | 1;
function ascendingSortStrategy(l: Sortable, r: Sortable): -1 | 0 | 1 {
  return l < r ? -1 : l > r ? 1 : 0;
}
function descendingSortStrategy(l: Sortable, r: Sortable): -1 | 0 | 1 {
  return l < r ? 1 : l > r ? -1 : 0;
}
export function sortBy<T>(selector: (value: T) => Sortable, strategy: SortStrategy<Sortable> = sortBy.asc) {
  return (left: T, right: T) => {
    return strategy(selector(left), selector(right));
  }
}
sortBy.asc = ascendingSortStrategy;
sortBy.desc = descendingSortStrategy;

export function groupBy<T, K>(source: T[], keySelector: (value: T) => K): { key: K, results: T[] }[];
export function groupBy<T, K, R>(source: T[], keySelector: (value: T) => K, resultSelector: (value: T) => R): { key: K, results: R[] }[]
export function groupBy<T, K, R>(source: T[], keySelector: (value: T) => K, resultSelector?: (value: T) => R) {
  return source.reduce(
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

export function uniq<T>(source: T[]): T[];
export function uniq<T, K>(source: T[], keySelector: (value: T) => K): T[];
export function uniq<T, K>(source: T[], keySelector?: (value: T) => K): T[] {
  if (!keySelector) {
    return Array.from(new Set(source));
  }

  const sentinel = new Set<K | T>();
  const results: T[] = [];

  for (const value of source) {
    const key = keySelector(value);

    const previousSize = sentinel.size;
    sentinel.add(key);

    if (previousSize !== sentinel.size) {
      results.push(value);
    }
  }

  return results;
}


export function sum(source: Iterable<number>): number {
  let acc = 0;
  for (const n of source) {
    acc += n;
  }
  return acc;
}
