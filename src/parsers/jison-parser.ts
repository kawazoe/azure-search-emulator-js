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
  deps: {
    mergeDeep: MergeDeepFunction,
    mergeSequence: MergeSequenceFunction,
    compare: <T>(left: T, right: T) => -1 | 0 | 1,
  },
  fns: Record<string, Function>
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
