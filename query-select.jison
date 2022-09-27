%lex

%%

"asc"                                      { return 'ORDER_ASCENDING' }
"desc"                                     { return 'ORDER_DESCENDING' }

[a-zA-Z_][a-zA-Z_0-9]*                     { return 'IDENTIFIER' }

"/"                                        { return 'FP_SEPARATOR' }
","                                        { return 'LIST_SEPARATOR' }

"*"                                        { return 'WILDCARD' }

\s+                                        /* skip whitespace */

<<EOF>>                                    { return 'EOF' }

/lex

%left ORDER_ASCENDING ORDER_DESCENDING
%token IDENTIFIER
%left FP_SEPARATOR LIST_SEPARATOR
%token WILDCARD

%parse-param ast mergeDeep mergeSequence

%ebnf

%start select_expression

%%

/* Top-level rules */
select_expression
    : WILDCARD EOF
    {
        yy.ast.value = { type: "WILDCARD" };
        yy.ast.apply = (input) => input;
    }
    | variable (LIST_SEPARATOR variable)* EOF
    {
        //
        {
        const mergeDeep = yy.mergeDeep;
        const mergeSequence = yy.mergeSequence;
        const keys = [$1, ...$2.map(([sep, clause]) => clause)];
        const apply = (input) => keys
            .reduce((acc, cur) => mergeDeep(
                    acc,
                    cur.apply(input),
                    { arrayMerge: mergeSequence }
                ),
                {}
            );
        yy.ast.value = { type: "LIST", value: keys };
        yy.ast.apply = apply;
        }
    }
    ;

/* Shared base rules */
variable
    : IDENTIFIER (FP_SEPARATOR IDENTIFIER)+
    {
        //
        {
        const value = [
            $1,
            ...$2.map(([sep, node]) => node),
        ];
        const apply = (input, [first, ...rest]) => ({
            [first]: rest.length
                ? Array.isArray(input[first])
                    ? input[first].map(v => apply(v, rest))
                    : apply(input[first], rest)
                : input[first]
        });

        $$ = { type: "FIELD_PATH", value, apply: (input) => apply(input, value) };
        }
    }
    | IDENTIFIER
    {
        //
        {
        const value = $1;
        $$ = { type: "IDENTIFIER", value, apply: (input) => ({ [value]: input[value] }) };
        }
    }
    ;
