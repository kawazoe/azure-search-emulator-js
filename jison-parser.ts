import type deepmerge from 'deepmerge';

export interface JisonParserErrorHash {
  recoverable: boolean;
  destroy: () => void;
  exception?: Error
}

export interface JisonParserError {
  new (msg: string | null | undefined, hash?: JisonParserErrorHash): JisonParserError;

  get name(): 'JisonParserError';

  get message(): string | null | undefined;
  set message(msg);
}

type DeepMergeExtendedOptions = deepmerge.Options & {
  isMergeableObject(value: unknown): boolean,
  cloneUnlessOtherwiseSpecified(value: unknown, options: deepmerge.Options): unknown,
};

export type MergeDeepFunction = (target: Partial<unknown>, source: Partial<unknown>, options: DeepMergeExtendedOptions) => unknown;
export type ParseFunction<TAst> = (
  input: string,
  ast: TAst,
  mergeDeep: MergeDeepFunction,
  mergeSequence: MergeSequenceFunction
) => boolean;
export type MergeSequenceFunction = (target: unknown[], source: unknown[], options: DeepMergeExtendedOptions) => unknown[];

export interface OParser<TAst> {
  trace: () => {},
  JisonParserError: JisonParserError,
  yy: {},
  options: {
    type: string,
    hasPartialLrUpgradeOnConflict: boolean,
    errorRecoveryTokenDiscardCount: number,
    ebnf: boolean,
  },
  symbols_: {
    $accept: 0,
    $end: 1,
    [key: string]: number,
  },
  terminals_: {
    1: 'EOF',
    2: 'error',
    [key: number]: string,
  },
  TERROR: number,
  EOF: number,
  quoteName: (id_str: string) => string;
  getSymbolName: (symbol: number) => string | null;
  describeSymbol: (symbol: number) => string | null;
  collect_expected_token_set: (state: number, do_not_describe: boolean) => string[];
  parseError: (str: string, hash: JisonParserErrorHash, ExceptionClass?: Error) => void;
  parse: ParseFunction<TAst>
  originalParseError: (str: string, hash: JisonParserErrorHash, ExceptionClass?: Error) => void;
  originalQuoteName: (id_str: string) => string;
}

export interface Parser<TAst> extends OParser<TAst> {
  yy: {};
  Parser: OParser<TAst>
}

export interface JisonParser<TAst> {
  parser: OParser<TAst>;
  Parser: Parser<TAst>;
  parse: ParseFunction<TAst>;
}

export type AstIdentifier = { type: 'IDENTIFIER', value: string };
export type AstFieldPath = { type: 'FIELD_PATH', value: string[] };

export type AstGroupExpression = { type: 'GROUP_EXPRESSION', value: FilterAst };
export type AstAllFilter = { type: 'ALL_FILTER', target: AstIdentifier | AstFieldPath, expression: FilterAst };
export type AstAnyFilter = { type: 'ANY_FILTER', target: AstIdentifier | AstFieldPath, expression?: FilterAst };
export type AstLambda = { type: 'LAMBDA', params: [AstIdentifier], expression: FilterAst };
export type AstAndExpression = { type: 'AND_EXPRESSION', left: FilterAst, right: FilterAst };
export type AstOrExpression = { type: 'OR_EXPRESSION', left: FilterAst, right: FilterAst };
export type AstNotExpression = { type: 'NOT_EXPRESSION', value: FilterAst };
export type AstComparison = { type: 'COMPARISON', left: FilterAst, op: 'gt' | 'lt' | 'ge' | 'le' | 'eq' | 'ne', right: FilterAst };
export type AstStringLiteral = { type: 'STRING', value: string };
export type AstDateTimeOffsetLiteral = { type: 'DATETIMEOFFSET', value: Date };
export type AstIntegerLiteral = { type: 'INTEGER', value: number };
export type AstFloatLiteral = { type: 'FLOAT', value: number };
export type AstNotANumberLiteral = { type: 'NOT_A_NUMBER' };
export type AstNegativeInfinityLiteral = { type: 'NEGATIVE_INFINITY' };
export type AstPositiveInfinityLiteral = { type: 'POSITIVE_INFINITY' };
export type AstBooleanLiteral = { type: 'BOOLEAN', value: boolean };
export type AstNullLiteral = { type: 'NULL' };
export type AstFnSearchIn =
  { type: 'FN_SEARCH_IN', variable: FilterAst, valueList: string } |
  { type: 'FN_SEARCH_IN', variable: FilterAst, valueList: string, delimiters: string };
export type AstFnSearchIsMatch =
  { type: 'FN_SEARCH_ISMATCH', search: string } |
  { type: 'FN_SEARCH_ISMATCH', search: string, searchFields: string } |
  { type: 'FN_SEARCH_ISMATCH', search: string, searchFields: string, queryType: 'full' | 'simple', searchMode: 'any' | 'all' };
export type AstFnSearchIsMatchScoring =
  { type: 'FN_SEARCH_ISMATCHSCORING', search: string } |
  { type: 'FN_SEARCH_ISMATCHSCORING', search: string, searchFields: string } |
  { type: 'FN_SEARCH_ISMATCHSCORING', search: string, searchFields: string, queryType: 'full' | 'simple', searchMode: 'any' | 'all' };

export type FilterAst =
  AstIdentifier |
  AstFieldPath |
  AstGroupExpression |
  AstAllFilter |
  AstAnyFilter |
  AstLambda |
  AstAndExpression |
  AstOrExpression |
  AstNotExpression |
  AstComparison |
  AstStringLiteral |
  AstDateTimeOffsetLiteral |
  AstIntegerLiteral |
  AstFloatLiteral |
  AstNotANumberLiteral |
  AstNegativeInfinityLiteral |
  AstPositiveInfinityLiteral |
  AstBooleanLiteral |
  AstNullLiteral |
  AstFnSearchIn |
  AstFnSearchIsMatch |
  AstFnSearchIsMatchScoring;

export type AstFnSearchScore = { type: 'FN_SEARCH_SCORE' };
export type AstOrder = { type: 'ORDER', target: AstIdentifier | AstFieldPath |  AstFnSearchScore, direction: 'asc' | 'desc' };

export type OrderByAst = AstOrder[];

export type AstWildcard = { type: 'WILDCARD' };

export type SelectAst =
  AstWildcard |
  (AstIdentifier | AstFieldPath)[];
