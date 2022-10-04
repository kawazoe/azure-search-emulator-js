import _filter from './query-filter';
import _orderBy from './query-orderby';
import _select from './query-select';

import deepmerge from 'deepmerge';

import { ODataSelect, ODataSelectResult } from '../lib/odata';
import { getStruct, getValue } from '../lib/objects';
import { MergeSequenceFunction } from './jison-parser';
import type {
  FilterAst,
  OrderByAst,
  SelectAst,
  FacetAst,
  FacetParamsAst,
  FacetResults
} from './asts';

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
    const ast = {} as SelectAst & { apply: <T extends object, Keys extends ODataSelect<T> = never>(input: T) => Keys extends never ? T : ODataSelectResult<T, Keys> };
    _select.parse(input, ast, dependencies, {});
    return ast;
  }
};
// TODO: highlight supports additional features like some/field/path-number to limit the highlight count
export const highlight = select;

export const facet = {
  parse: (input: string): FacetAst => {
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

    const apply = <T>(accumulator: FacetResults, input: T) => {
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

    return { field, params, apply };
  }
}