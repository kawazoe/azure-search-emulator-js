import { Facetable } from '../services';

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
export type AstNotANumberLiteral = { type: 'NOT_A_NUMBER', value: number };
export type AstNegativeInfinityLiteral = { type: 'NEGATIVE_INFINITY', value: number };
export type AstPositiveInfinityLiteral = { type: 'POSITIVE_INFINITY', value: number };
export type AstBooleanLiteral = { type: 'BOOLEAN', value: boolean };
export type AstNullLiteral = { type: 'NULL', value: null };
export type AstGeoPointLiteral = { type: 'GEO_POINT', lon: number, lat: number };
export type AstGeoPolygonLiteral = { type: 'GEO_POLYGON', points: { lon: number, lat: number }[] };
export type AstFnGeoDistance = { type: 'FN_GEO_DISTANCE', from: AstIdentifier |AstGeoPointLiteral, to: AstIdentifier |AstGeoPointLiteral };
export type AstFnGeoIntersects = { type: 'FN_GEO_INTERSECTS', point: AstIdentifier, polygon: AstGeoPolygonLiteral };
export type AstFnSearchIn =
  { type: 'FN_SEARCH_IN', variable: FilterAst, valueList: AstStringLiteral } |
  { type: 'FN_SEARCH_IN', variable: FilterAst, valueList: AstStringLiteral, delimiter: AstStringLiteral };
export type AstFnSearchIsMatch =
  { type: 'FN_SEARCH_ISMATCH', search: AstStringLiteral } |
  { type: 'FN_SEARCH_ISMATCH', search: AstStringLiteral, searchFields: AstStringLiteral } |
  { type: 'FN_SEARCH_ISMATCH', search: AstStringLiteral, searchFields: AstStringLiteral, queryType: 'full' | 'simple', searchMode: 'any' | 'all' };
export type AstFnSearchIsMatchScoring =
  { type: 'FN_SEARCH_ISMATCHSCORING', search: AstStringLiteral } |
  { type: 'FN_SEARCH_ISMATCHSCORING', search: AstStringLiteral, searchFields: AstStringLiteral } |
  { type: 'FN_SEARCH_ISMATCHSCORING', search: AstStringLiteral, searchFields: AstStringLiteral, queryType: 'full' | 'simple', searchMode: 'any' | 'all' };

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
  AstGeoPointLiteral |
  AstGeoPolygonLiteral |
  AstFnGeoDistance |
  AstFnGeoIntersects |
  AstFnSearchIn |
  AstFnSearchIsMatch |
  AstFnSearchIsMatchScoring;

export type AstList<T> = { type: 'LIST', value: T[] };

export type AstFnSearchScore = { type: 'FN_SEARCH_SCORE' };
export type AstOrder = { type: 'ORDER', target: AstIdentifier | AstFieldPath |  AstFnSearchScore, direction: 'asc' | 'desc' };

export type OrderByAst = AstList<AstOrder>;

export type AstWildcard = { type: 'WILDCARD' };

export type SelectAst =
  AstWildcard |
  AstList<AstIdentifier | AstFieldPath>;

export function toPaths(ast: SelectAst) {
  return ast.type === 'WILDCARD'
    ? []
    : ast.value.map(f =>
      Array.isArray(f.value)
        ? f.value.join('/')
        : f.value
    );
}

export type FacetParamsAst = {
  count: number,
  sort?: (left: [string, number], right: [string, number]) => -1 | 0 | 1,
  values?: string,
  interval?: string,
  timeoffset?: string,
};
export type FacetResult = { params: FacetParamsAst, results: Record<string, number> };
export type FacetResults = Record<string, FacetResult>;
export type FacetActions = {
  canApply: (schema: Facetable[]) => string[],
  apply: <T extends object>(accumulator: FacetResults, input: T) => FacetResults,
};
export type FacetAst = { field: string, params: FacetParamsAst };

export type AstQuote = { type: 'QUOTE', value: string };
export type AstWord = { type: 'WORD', value: string };
export type AstPhrase = AstQuote | AstWord;

export type AstPartial = { type: 'PARTIAL', value: AstPhrase };
export type AstClause = AstPartial | AstPhrase;

export type AstLogicalExpression = { type: 'EXPRESSION', left: AstExpression, op: 'not' | 'and' | 'or', right: AstExpression };
export type AstExpression = AstLogicalExpression | AstClause;

export type AstEmpty = { type: 'EMPTY' };
export type SimpleAst = AstExpression | AstEmpty;
