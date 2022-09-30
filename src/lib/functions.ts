export function pipe<A, B>(
  value: A,
  fn1: (a: A) => B,
): B;
export function pipe<A, B, C>(
  value: A,
  fn1: (a: A) => B,
  fn2: (a: B) => C,
): C;
export function pipe<A, B, C, D>(
  value: A,
  fn1: (a: A) => B,
  fn2: (a: B) => C,
  fn3: (a: C) => D,
): D;
export function pipe<A, B, C, D, E>(
  value: A,
  fn1: (a: A) => B,
  fn2: (a: B) => C,
  fn3: (a: C) => D,
  fn4: (a: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
  value: A,
  fn1: (a: A) => B,
  fn2: (a: B) => C,
  fn3: (a: C) => D,
  fn4: (a: D) => E,
  fn5: (a: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
  value: A,
  fn1: (a: A) => B,
  fn2: (a: B) => C,
  fn3: (a: C) => D,
  fn4: (a: D) => E,
  fn5: (a: E) => F,
  fn6: (a: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
  value: A,
  fn1: (a: A) => B,
  fn2: (a: B) => C,
  fn3: (a: C) => D,
  fn4: (a: D) => E,
  fn5: (a: E) => F,
  fn6: (a: F) => G,
  fn7: (a: G) => H,
): H;
export function pipe<A>(value: A, ...fns: ((v: any) => any)[]): any {
  return fns.reduce((a, c) => c(a), value);
}