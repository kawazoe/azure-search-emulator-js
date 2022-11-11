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

export type ParseFunction<TAst, TArgs extends unknown[]> = (
  input: string,
  ast: TAst,
  ...args: TArgs
) => boolean;

export interface OParser<TAst, TArgs extends unknown[]> {
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
  parse: ParseFunction<TAst, TArgs>
  originalParseError: (str: string, hash: JisonParserErrorHash, ExceptionClass?: Error) => void;
  originalQuoteName: (id_str: string) => string;
}

export interface YaccLexParser<TAst, TArgs extends unknown[]> extends OParser<TAst, TArgs> {
  yy: {};
  Parser: OParser<TAst, TArgs>
}

export interface JisonParser<TAst, TArgs extends unknown[]> {
  parser: OParser<TAst, TArgs>;
  Parser: YaccLexParser<TAst, TArgs>;
  parse: ParseFunction<TAst, TArgs>;
}
