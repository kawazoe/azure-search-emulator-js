import _filter, { FilterActions } from './query-filter';
import _orderBy, { OrderByActions } from './query-orderby';
import _select, { SelectActions } from './query-select';
import _simple, { SimpleActions } from './query-simple';
import deepmerge from 'deepmerge';

import { getStruct, getValue } from '../lib/objects';

import type {
  FacetActions,
  FacetAst,
  FacetParamsAst,
  FacetResults,
  FilterAst,
  OrderByAst,
  SelectAst,
  SimpleAst
} from './asts';
import { toPaths } from './asts';
import type { Facetable, Filterable, Retrievable, Searchable, Sortable } from '../services';
import { flatValue } from '../services/utils';
import type { GeoPoint, } from '../lib/geo';
import { calculateDistance, intersects, isGeoPoint, makeGeoPointFromPojo, makeGeoPolygon } from '../lib/geo';
import { score } from '../services';

const mergeDeep = deepmerge;
export type DeepMergeExtendedOptions = deepmerge.Options & {
  isMergeableObject(value: unknown): boolean,
  cloneUnlessOtherwiseSpecified(value: unknown, options: deepmerge.Options): unknown,
};
export type MergeSequenceFunction = (target: unknown[], source: unknown[], options: DeepMergeExtendedOptions) => unknown[];

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

function createMatchSchema<TNamed extends { name: string }>(descriptor: string): (schema: TNamed[], fieldPath: string[]) => ([] | [string]) {
  return (schema, fieldPath) => {
    const name = fieldPath.join('/');

    const found = schema.find(f => f.name === name);

    return found ? [] : [`Field ${name} is not ${descriptor}`];
  }
}

// Used in jison parsers.
// noinspection JSUnusedGlobalSymbols
const dependencies = {
  mergeDeep,
  mergeSequence,
  compare,
  getValue,
  getStruct,
  makeGeoPointFromPojo,
  makeGeoPolygon,
  score,
};

function fn_geo_distance<T>(
  input: T,
  fromVariable: { value: unknown, apply: (input: T) => unknown },
  toPoint: GeoPoint,
) {
  const from = fromVariable.apply(input);
  if (!isGeoPoint(from)) {
    throw new Error(`Unsupported operation. Expected ${fromVariable.value} to be a GeoPoint but got ${JSON.stringify(from)}`);
  }

  return calculateDistance(
    from,
    toPoint,
  ) / 1000;
}
function fn_geo_intersects<T>(
  input: T,
  pointVariable: { value: unknown, apply: (input: T) => unknown },
  polygon: { lon: number, lat: number }[],
) {
  const point = pointVariable.apply(input);
  if (!(isGeoPoint(point))) {
    throw new Error(`Unsupported operation. Expected ${pointVariable.value} to be a GeoPoint but got ${JSON.stringify(point)}`);
  }

  return intersects(point, polygon);
}
function fn_search_score(input: Record<string, unknown>) {
  return input['@search.score'];
}
function fn_search_in<T>(
  input: T,
  variable: { value: unknown, apply: (input: T) => unknown },
  valueList: string,
  delimiter?: string,
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
  // TODO: Use analyzer to process search string.
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

export type Parser<R, Args extends unknown[] = []> = {
  parse: (input: string, ...args: Args) => R,
};

export type SelectParserResult = SelectAst & SelectActions;
export type SelectParser = Parser<SelectParserResult>;
export const select: SelectParser = {
  parse: (input: string) => {
    const ast = {} as SelectAst & SelectActions;
    _select.parse(input, ast, { ...dependencies, matchSchema: createMatchSchema<Retrievable>('retrievable') }, {});
    return {
      ...ast,
    };
  }
};

export type SearchParserResult = SelectAst & SelectActions;
export type SearchParser = Parser<SearchParserResult>;
export const search: SearchParser = {
  parse: (input: string) => {
    const ast = {} as SelectAst & SelectActions;
    _select.parse(input, ast, { ...dependencies, matchSchema: createMatchSchema<Searchable>('searchable') }, {});
    return {
      ...ast,
      toPaths: () => toPaths(ast),
    };
  }
};

export type FilterParserResult = FilterAst & FilterActions;
export type FilterParser = Parser<FilterParserResult>;
export const filter: FilterParser = {
  parse: (input: string) => {
    const ast = {} as FilterAst & FilterActions;
    // noinspection JSUnusedGlobalSymbols
    _filter.parse(input, ast, { ...dependencies, matchSchema: createMatchSchema<Filterable>('filterable') }, { fn_geo_distance, fn_geo_intersects, fn_search_in, fn_search_ismatch, fn_search_ismatchscoring });
    return {
      ...ast,
    };
  }
};

export type OrderByParserResult = OrderByAst & OrderByActions;
export type OrderByParser = Parser<OrderByParserResult>;
export const orderBy: OrderByParser = {
  parse: (input: string) => {
    const ast = {} as OrderByAst & OrderByActions;
    // noinspection JSUnusedGlobalSymbols
    _orderBy.parse(input, ast, { ...dependencies, matchSchema: createMatchSchema<Sortable>('sortable') }, { fn_search_score });
    return {
      ...ast,
    };
  }
};

export type HighlighParserResult = SelectAst & SelectActions;
export type HighlighParser = Parser<HighlighParserResult>;
// TODO: highlight supports additional features like some/field/path-number to limit the highlight count
export const highlight: HighlighParser = search;

export type FacetParserResult = FacetAst & FacetActions;
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

    const matchSchema = createMatchSchema<Facetable>('facetable');
    function canApply(schema: Facetable[]) {
      return matchSchema(schema, fieldPath);
    }

    function apply<T extends object>(accumulator: FacetResults, input: T) {
      if (!accumulator[field]) {
        accumulator[field] = {
          params,
          results: {},
        };
      }
      const acc = accumulator[field];

      const value = flatValue(getValue(input, fieldPath)).map(v => `${v}`);
      for (const val of value) {
        const counter = acc.results[val];
        acc.results[val] = counter ? counter + 1 : 1;
      }

      return accumulator;
    }

    return { field, params, canApply, apply };
  }
}

export type SimpleParserResult = SimpleAst & SimpleActions;
export type SimpleParser = Parser<SimpleParserResult, [searchMode: 'any' | 'all']>;
export const simple: SimpleParser = {
  parse: (input: string, searchMode) => {
    const ast = {} as SimpleAst & SimpleActions;
    _simple.parse(input, ast, searchMode, dependencies);
    return ast;
  }
};
