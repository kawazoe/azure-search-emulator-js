import type { JisonParser } from './jison-parser';
import type { SelectAst } from './asts';

export type SelectActions = {
  canApply: (schema: unknown, require: unknown) => string[],
  apply: (input: unknown) => unknown,
  toPaths: () => string[],
};
declare const parser: JisonParser<SelectAst & SelectActions>;
export default parser;