import _filter from './generated/query-filter';
import _orderBy from './generated/query-orderby';
import _select from './generated/query-select';

import deepmerge from 'deepmerge';

import type { MergeSequenceFunction, FilterAst, OrderByAst, SelectAst } from './jison-parser';

const mergeDeep = deepmerge;
const mergeSequence: MergeSequenceFunction = (target, source, options) => {
  const destination = target.slice()

  source.forEach((item, index) => {
    if (typeof destination[index] === 'undefined') {
      destination[index] = options.cloneUnlessOtherwiseSpecified(item, options)
    } else if (options.isMergeableObject(item)) {
      destination[index] = deepmerge(target[index]!, item!, options)
    } else if (target.indexOf(item) === -1) {
      destination.push(item)
    }
  })
  return destination
}
function compare<T>(left: T, right: T): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}
function getValue(input: any, [first, ...rest]: string[]): any {
  if (first == null) {
    throw new Error('Invalid operation. Second parameter requires at least one value.');
  }

  return rest.length
    ? Array.isArray(input[first])
      ? input[first].map((v: any) => getValue(v, rest))
      : getValue(input[first], rest)
    : input[first];
}
function getStruct(input: any, [first, ...rest]: string[]): any {
  if (first == null) {
    throw new Error('Invalid operation. Second parameter requires at least one value.');
  }

  return {
    [first]: rest.length
      ? Array.isArray(input[first])
        ? input[first].map((v: any) => getStruct(v, rest))
        : getStruct(input[first], rest)
      : input[first]
  };
}

const dependencies = {
  mergeDeep,
  mergeSequence,
  compare,
  getValue,
  getStruct,
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

export const filter = {
  ..._filter,
  parse: (input: string) => {
    const ast = {} as FilterAst & { apply: <T>(input: T) => number};
    _filter.parse(input, ast, dependencies, { fn_search_in, fn_search_ismatch, fn_search_ismatchscoring });
    return ast;
  }
};
export const orderBy = {
  ..._orderBy,
  parse: (input: string) => {
    const ast = {} as OrderByAst & { apply: <T>(left: T, right: T) => -1 | 0 | 1 };
    _orderBy.parse(input, ast, dependencies, { fn_search_score });
    return ast;
  }
};
export const select = {
  ..._select,
  parse: (input: string) => {
    const ast = {} as SelectAst & { apply: <T>(input: T) => Partial<T> };
    _select.parse(input, ast, dependencies, {});
    return ast;
  }
};