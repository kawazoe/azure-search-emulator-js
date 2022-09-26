%lex

%%

"asc"                                      { return 'ORDER_ASCENDING' }
"desc"                                     { return 'ORDER_DESCENDING' }

"search.score"                             { return 'FN_SEARCH_SCORE' }

[a-zA-Z_][a-zA-Z_0-9]*                     { return 'IDENTIFIER' }

"/"                                        { return 'FP_SEPARATOR' }
","                                        { return 'LIST_SEPARATOR' }
"("                                        { return 'GROUP_OPEN' }
")"                                        { return 'GROUP_CLOSE' }

"*"                                        { return 'WILDCARD' }

\s+                                        /* skip whitespace */

<<EOF>>                                    { return 'EOF' }

/lex

%left ORDER_ASCENDING ORDER_DESCENDING
%token FN_SEARCH_SCORE
%token IDENTIFIER
%left FP_SEPARATOR LIST_SEPARATOR
%token GROUP_OPEN GROUP_CLOSE
%token WILDCARD

%parse-param ast

%ebnf

%start order_by_expression

%%

/* Top-level rules */
order_by_expression
    : order_by_clause (LIST_SEPARATOR order_by_clause)* EOF
    { yy.ast.value = [$1, ...$2.map(([sep, clause]) => clause)] }
    ;

order_by_clause
    : variable (ORDER_ASCENDING | ORDER_DESCENDING)?
    { $$ = { type: "ORDER", target: $1, direction: $2 || "asc" } }
    | sortable_function (ORDER_ASCENDING | ORDER_DESCENDING)?
    { $$ = { type: "ORDER", target: $1, direction: $2 || "asc" } }
    ;
sortable_function
//     : geo_distance_call
    : FN_SEARCH_SCORE GROUP_OPEN GROUP_CLOSE    { $$ = { type: "FN_SEARCH_SCORE" } }
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
