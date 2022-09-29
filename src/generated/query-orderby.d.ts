import { OrderByAst, JisonParser } from '../jison-parser';

declare const parser: JisonParser<OrderByAst & { apply: <T>(left: T, right: T) => -1 | 0 | 1 }>;
export default parser;