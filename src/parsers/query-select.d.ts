import { JisonParser } from './jison-parser';
import { SelectAst } from './asts';
import { ODataSelect, ODataSelectResult } from '../lib/odata';

declare const parser: JisonParser<SelectAst & { apply: <T extends object, Keys extends ODataSelect<T> = never>(input: T) => Keys extends never ? T : ODataSelectResult<T, Keys> }>;
export default parser;