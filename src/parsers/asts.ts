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

export type FacetParamsAst = {
  count: number,
  sort?: (left: [string, number], right: [string, number]) => -1 | 0 | 1,
  values?: string,
  interval?: string,
  timeoffset?: string,
};
export type FacetResult = { params: FacetParamsAst, results: Record<string, number> };
export type FacetResults = Record<string, FacetResult>;
export type FacetAst = { field: string, params: FacetParamsAst, apply: <T>(accumulator: FacetResults, input: T) => FacetResults };