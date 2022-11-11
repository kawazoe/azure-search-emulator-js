import type { JisonParser } from './jison-parser';
import type { FilterAst } from './asts';

export type FilterActions = {
  canApply: (schema: unknown) => string[],
  apply: <T>(input: T) => number,
}
declare const parser: JisonParser<FilterAst & FilterActions>;
export default parser;
