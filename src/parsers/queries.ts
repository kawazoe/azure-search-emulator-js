import _filter, { FilterActions } from './query-filter';
import _orderBy, { OrderByActions } from './query-orderby';
import _select, { SelectActions } from './query-select';

import deepmerge from 'deepmerge';

import { getStruct, getValue } from '../lib/objects';

import type { MergeSequenceFunction} from './jison-parser';
import type {
  FilterAst,
  OrderByAst,
  SelectAst,
  FacetAst,
  FacetParamsAst,
  FacetResults,
  FacetActions
} from './asts';
import { FlatSchema, matchFieldRequirement, SchemaMatcherRequirements } from '../services/schema';

const mergeDeep = deepmerge;
const mergeSequence: MergeSequenceFunction = (target, source, options) => {
  const destination = [...target];

  for (let index = 0; index < source.length; index++) {
    const item = source[index];

    if (typeof destination[index] === 'undefined') {
      destination[index] = options.cloneUnlessOtherwiseSpecified(item, options);
    } else if (options.isMergeableObject(item)) {
      destination[index] = deepmerge(target[index]!, item!, options);
    } else if (target.indexOf(item) === -1) {
      destination.push(item);
    }
  }

  return destination;
}
function compare<T>(left: T, right: T): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

function matchSchema(schema: FlatSchema, require: SchemaMatcherRequirements, fieldPath: string[]): [] | [string] {
  const result = matchFieldRequirement(schema, fieldPath.join('/'), require);
  return result ? [result] : [];
}

const dependencies = {
  mergeDeep,
  mergeSequence,
  compare,
  getValue,
  getStruct,
  matchSchema,
};

function fn_search_score(input: Record<string, unknown>) {
  return input['@search.score'];
}
function fn_search_in<T>(
  input: T,
  variable: { value: unknown, apply: (input: T) => unknown },
  valueList: string,
  delimiter?: string
) {
  const haystack = variable.apply(input);
  if (typeof haystack !== 'string') {
    throw new Error(`Unsupported operation. Expected ${variable.value} to be a string but got ${JSON.stringify(haystack)}.`);
  }
  return valueList.split(delimiter ?? ',')
    .map(s => {
      const needle = s.trim();
      return haystack.includes(needle) ? needle.length : 0;
    })
    .reduce((acc, cur) => cur > acc ? cur : acc, 0);
}
function fn_search_ismatch(input: any, search: string, searchFields: string, queryType: 'full' | 'simple', searchMode: 'any' | 'all') {
  return fn_search_ismatchscoring(input, search, searchFields, queryType, searchMode) ? 1 : 0;
}
function fn_search_ismatchscoring(input: any, search: string, searchFields?: string, queryType?: 'full' | 'simple', searchMode?: 'any' | 'all') {
  // TODO: Implement full-text search. Consider using lyra (no lucene syntax) or lunr (maybe a maintained fork?).
  const fields = searchFields
    ? searchFields.split(',').map(f => f.trim())
    : Object.keys(input);

  let stop = false;
  return fields
    .map(field => {
      const value = input[field];

      if (typeof value !== 'string') {
        throw new Error(`Unsupported operation. Expected ${field} to be of type string but got ${JSON.stringify(value)}`);
      }

      return queryType === 'full'
        ? Array.from(value.matchAll(new RegExp(search, 'g')))
        : (value.includes(search) ? search.length : 0)
    })
    .reduce((acc: number, cur) => {
      if (stop) {
        return acc;
      }

      let result;
      if (typeof cur === 'number') {
        result = acc + cur;
      } else {
        result = acc + cur
          .map(([r]) => r?.length ?? 0)
          .reduce((a, c) => a + c, 0);
      }

      if (result === 0 && searchMode === 'all') {
        stop = true;
      }

      return result;
    }, 0);
}

export type ParserResult<TAst, TActions> = TAst & Omit<TActions, 'canApply'> & {
  canApply: (schema: FlatSchema) => string[]
};
export type Parser<R> = {
  parse: (input: string) => R,
};

export type FilterParserResult = ParserResult<FilterAst, FilterActions>;
export type FilterParser = Parser<FilterParserResult>;
export const filter: FilterParser = {
  parse: (input: string) => {
    const ast = {} as FilterAst & FilterActions;
    _filter.parse(input, ast, dependencies, { fn_search_in, fn_search_ismatch, fn_search_ismatchscoring });
    return {
      ...ast,
      canApply: (schema: FlatSchema) => ast.canApply(schema, 'filterable'),
    };
  }
};

export type OrderByParserResult = ParserResult<OrderByAst, OrderByActions>;
export type OrderByParser = Parser<OrderByParserResult>;
export const orderBy: OrderByParser = {
  parse: (input: string) => {
    const ast = {} as OrderByAst & OrderByActions;
    _orderBy.parse(input, ast, dependencies, { fn_search_score });
    return {
      ...ast,
      canApply: (schema: FlatSchema) => ast.canApply(schema, 'sortable'),
    };
  }
};

export type SelectParserResult = ParserResult<SelectAst, SelectActions>;
export type SelectParser = Parser<SelectParserResult>;
export const select: SelectParser = {
  parse: (input: string) => {
    const ast = {} as SelectAst & SelectActions;
    _select.parse(input, ast, dependencies, {});
    return {
      ...ast,
      canApply: (schema: FlatSchema) => ast.canApply(schema, 'retrievable'),
    };
  }
};

export type SearchParserResult = ParserResult<SelectAst, SelectActions>;
export type SearchParser = Parser<SearchParserResult>;
export const search: SearchParser = {
  parse: (input: string) => {
    const ast = {} as SelectAst & SelectActions;
    _select.parse(input, ast, dependencies, {});
    return {
      ...ast,
      canApply: (schema: FlatSchema) => ast.canApply(schema, 'searchable'),
    };
  }
};

export type HighlighParserResult = ParserResult<SelectAst, SelectActions>;
export type HighlighParser = Parser<HighlighParserResult>;
// TODO: highlight supports additional features like some/field/path-number to limit the highlight count
export const highlight: HighlighParser = search;

export type FacetParserResult = ParserResult<FacetAst, FacetActions>;
export type FacetParser = Parser<FacetParserResult>;
export const facet: FacetParser = {
  parse: (input: string) => {
    const [field, ...candidateParams] = input
      .split(',')
      .map(s => s.trim());

    if (!field) {
      throw new Error('Invalid facet. Missing field.');
    }

    const params = candidateParams
      .map(p => {
        const [name, value] = p
          .split(':')
          .map(s => s.trim());

        if (!name || !value) {
          throw new Error('Invalid facet. Param has missing name or value.');
        }

        return [name, value];
      })
      .reduce(
        (acc, [name, value]) => {
          switch (name) {
            case 'count':
              acc[name] = parseInt(value);
              break;
            case 'sort':
              if (value.endsWith('value')) {
                acc[name] = (l, r) => compare(l[0], r[0]);
              }
              if (value.endsWith('count')) {
                acc[name] = (l, r) => compare(l[1], r[1]);
              }

              const comp = acc[name];
              if (comp && value.startsWith('-')) {
                acc[name] = (l, r) => comp(r, l);
              }
              break;
            case 'values':
            case 'interval':
            case 'timeoffset':
              acc[name] = value;
              break;
          }
          return acc;
        },
        { count: 10 } as FacetParamsAst
      );

    const fieldPath = field.split('/');

    function canApply(schema: FlatSchema) {
      const result = matchFieldRequirement(schema, field, 'facetable');
      return result ? [result] : [];
    }

    function apply<T>(accumulator: FacetResults, input: T) {
      if (!accumulator[field]) {
        accumulator[field] = {
          params,
          results: {},
        };
      }
      const acc = accumulator[field];
      const value = `${getValue(input, fieldPath)}`;

      const counter = acc.results[value];
      acc.results[value] = counter ? counter + 1 : 1;

      return accumulator;
    }

    return { field, params, canApply, apply };
  }
}