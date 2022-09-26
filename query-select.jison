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

%parse-param ast

%ebnf

%start select_expression

%%

/* Top-level rules */
select_expression
    : WILDCARD EOF
    { yy.ast.value = { type: "WILDCARD" } }
    | variable (LIST_SEPARATOR variable)* EOF
    { yy.ast.value = [$1, ...$2.map(([sep, clause]) => clause)] }
    ;

/* Shared base rules */
variable
    : IDENTIFIER (FP_SEPARATOR IDENTIFIER)+
    {
        $$ = {
            type: "FIELD_PATH",
            value: [
                $1,
                ...$2.map(([sep, node]) => node),
            ],
        };
    }
    | IDENTIFIER
    { $$ = { type: "IDENTIFIER", value: $1 } }
    ;
