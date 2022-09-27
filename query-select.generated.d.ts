import { SelectAst, JisonParser } from './jison-parser';

declare const parser: JisonParser<SelectAst & { apply: <T>(input: T) => Partial<T> }>;
export default parser;