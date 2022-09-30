export function sum(array: number[]): number {
  return array.reduce((a, c) => a + c, 0);
}

export function flatten<T>(array: T[][]): T[] {
  return array.reduce(
    (acc, cur) => {
      acc.push(...cur);
      return acc;
    },
    []
  );
}