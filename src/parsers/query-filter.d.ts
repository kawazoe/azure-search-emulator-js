import { JisonParser } from './jison-parser';
import { FilterAst } from './asts';

declare const parser: JisonParser<FilterAst & { apply: <T>(input: T) => number }>;
export default parser;