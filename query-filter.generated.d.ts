import { FilterAst, JisonParser } from './jison-parser';

declare const parser: JisonParser<FilterAst & { apply: <T>(input: T) => number }>;
export default parser;