import _filter from './query-filter.generated';
import _orderBy from './query-orderby.generated';
import _select from './query-select.generated';

import deepmerge from 'deepmerge';

import type { MergeSequenceFunction, JisonParser } from './jison-parser';

const mergeSequences: MergeSequenceFunction = (target, source, options) => {
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

function wrap<TAst>(parser: JisonParser<TAst>): Omit<JisonParser<TAst>, 'parse'> & { parse: (input: string) => TAst } {
  return {
    ...parser,
    parse: (input: string) => {
      const ast: TAst = {} as TAst;
      parser.parse(input, ast, deepmerge, mergeSequences);
      return ast;
    }
  }
}

export const filter = wrap(_filter);
export const orderBy = wrap(_orderBy);
export const select = wrap(_select);