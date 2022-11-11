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

const joinSkip = Symbol('join.skip');
export function join<L, R, Result, LK = keyof L, RK = keyof R>(
  left: L[],
  right: R[],
  leftKeySelector: (v: L) => LK,
  rightKeySelector: (v: R) => RK,
  resultSelector: (l: L | null, r: R | null) => (Result | typeof join.skip)
): Result[] {
  const rightMap: Map<RK | LK, R[] | null> = right
    .reduce(
      (acc, cur) => {
        const rightCandidate = rightKeySelector(cur);

        let group = acc.get(rightCandidate);
        if (!group) {
          group = [];
          acc.set(rightCandidate, group);
        }

        group.push(cur);

        return acc;
      },
      new Map(),
    );
  const leftResults = left
    .reduce(
      (acc, cur) => {
        const key = leftKeySelector(cur);
        const rightCandidates = rightMap.get(key);

        if (rightCandidates) {
          for (const rightCandidate of rightCandidates) {
            const result = resultSelector(cur, rightCandidate);

            if (result !== join.skip) {
              acc.push(result);
            }
          }

          rightMap.set(key, null);
        } else {
          const result = resultSelector(cur, null);

          if (result !== join.skip) {
            acc.push(result);
          }
        }

        return acc;
      },
      [] as Result[],
    );
  return Array.from(rightMap)
    .reduce(
      (acc, cur) => {
        const rightCandidates = cur[1];

        if (rightCandidates) {
          for (const rightCandidate of rightCandidates) {
            const result = resultSelector(null, rightCandidate);

            if (result !== join.skip) {
              acc.push(result);
            }
          }
        }

        return acc;
      },
      leftResults
    );
}
join.skip = joinSkip;

export function distribute<T>(source: Iterable<T>, buckets: 1): [T][];
export function distribute<T>(source: Iterable<T>, buckets: 2): [T, T?][];
export function distribute<T>(source: Iterable<T>, buckets: 3): [T, T?, T?][];
export function distribute<T>(source: Iterable<T>, buckets: 4): [T, T?, T?, T?][];
export function distribute<T>(source: Iterable<T>, buckets: number): (T | undefined)[][] {
  const result = [];
  let bucket = [];
  for (const value of source) {
    bucket.push(value);

    if (bucket.length >= buckets) {
      result.push(bucket);
      bucket = [];
    }
  }

  if (bucket.length > 0) {
    result.push(bucket);
  }

  return result;
}

export function sum(source: Iterable<number>): number {
  let acc = 0;
  for (const n of source) {
    acc += n;
  }
  return acc;
}
export function average(source: Iterable<number>): number {
  let acc = 0;
  let count = 0;
  for (const n of source) {
    acc += n;
    count++;
  }
  return acc / count;
}
export function min(source: Iterable<number>): number {
  let acc = Number.MAX_SAFE_INTEGER;
  for (const n of source) {
    if (n < acc) {
      acc = n;
    }
  }
  return acc;
}
export function max(source: Iterable<number>): number {
  let acc = Number.MIN_SAFE_INTEGER;
  for (const n of source) {
    if (n > acc) {
      acc = n;
    }
  }
  return acc;
}
