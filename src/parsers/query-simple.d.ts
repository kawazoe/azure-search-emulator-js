import type { JisonParser } from './jison-parser';
import type { SimpleAst } from './asts';

import { MatchMode, QueryAnalyzisResult, TermAnalyzisResult } from '../services';

export type SimpleActions = {
  analyze: (analyzeFn: (query: string, matchMode: MatchMode) => TermAnalyzisResult) => QueryAnalyzisResult
};
declare const parser: JisonParser<SimpleAst & SimpleActions>;
export default parser;
