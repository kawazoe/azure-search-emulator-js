import _filter from './query-filter.generated';
import _orderBy from './query-orderby.generated';
import _select from './query-select.generated';

export const filter = _filter.Parser;
export const orderBy = _orderBy.Parser;
export const select = _select.Parser;