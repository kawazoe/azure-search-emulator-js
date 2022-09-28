import _filter from './query-filter.generated';
import _orderBy from './query-orderby.generated';
import _select from './query-select.generated';

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
function get(input: any, [first, ...rest]: string[]): any {
  if (first == null) {
    throw new Error('Invalid operation. Second parameter requires at least one value.');
  }
  return {
    [first]: rest.length
      ? Array.isArray(input[first])
        ? input[first].map((v: any) => get(v, rest))
        : get(input[first], rest)
      : input[first]
  };
}

const dependencies = {
  mergeDeep,
  mergeSequence,
  compare,
  get
};

function fn_search_score(input: Record<string, unknown>) {
  return input['@search.score'];
}

export const filter = {
  ..._filter,
  parse: (input: string) => {
    const ast = {} as FilterAst;
    _filter.parse(input, ast, dependencies, {});
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