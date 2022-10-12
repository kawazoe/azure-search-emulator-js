import type { JisonParser } from './jison-parser';
import type { OrderByAst } from './asts';

export type OrderByActions = {
  canApply: (schema: unknown, require: unknown) => string[],
  apply: <T>(left: T, right: T) => -1 | 0 | 1,
};
declare const parser: JisonParser<OrderByAst & OrderByActions >;
export default parser;