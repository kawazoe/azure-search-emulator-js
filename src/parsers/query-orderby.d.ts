import { JisonParser } from './jison-parser';
import { OrderByAst } from './asts';

declare const parser: JisonParser<OrderByAst & { apply: <T>(left: T, right: T) => -1 | 0 | 1 }>;
export default parser;