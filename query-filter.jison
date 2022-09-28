%lex

date_part           [0-9]{4}-((0[1-9])|(1[0-2]))-((0[1-9])|([1-2][0-9])|(3[0-1]))
time_part           (([0-1][0-9])|(2[0-3]))\:[0-5][0-9](\:[0-5][0-9](\.[0-9]+)?)?
time_zone_part      Z|([\-\+](([0-1][0-9])|(2[0-3]))\:[0-5][0-9])

%%

"true"                                     { return 'TRUE' }
"false"                                    { return 'FALSE' }
"not"                                      { return 'NOT' }
"and"                                      { return 'AND' }
"or"                                       { return 'OR' }

"gt"                                       { return 'GREATER_THAN' }
"lt"                                       { return 'LOWER_THAN' }
"ge"                                       { return 'GREATER_OR_EQUAL' }
"le"                                       { return 'LOWER_OR_EQUAL' }
"eq"                                       { return 'EQUAL' }
"ne"                                       { return 'NOT_EQUAL' }

"null"                                     { return 'NULL_LITERAL' }
"NaN"                                      { return 'NOT_A_NUMBER_LITERAL' }
"-INF"                                     { return 'NEGATIVE_INFINITY_LITERAL' }
"INF"                                      { return 'POSITIVE_INFINITY_LITERAL' }

"search.in"                                { return 'FN_SEARCH_IN' }
"search.ismatchscoring"                    { return 'FN_SEARCH_ISMATCHSCORING' }
"search.ismatch"                           { return 'FN_SEARCH_ISMATCH' }

(\'full\')|(\'simple\')                    { return 'QUERY_TYPE' }
(\'any\')|(\'all\')                        { return 'SEARCH_MODE' }

{date_part}T{time_part}{time_zone_part}    { return 'DATE_TIME_OFFSET_LITERAL' }
[a-zA-Z_][a-zA-Z_0-9]*                     { return 'IDENTIFIER' }
[\-\+]?[0-9]+\.[0-9]+(\e[\-\+]?[0-9]+)?    { return 'FLOAT_LITERAL' }
[\-\+]?[0-9]+                              { return 'INTEGER_LITERAL' }
\'([^']|(''))*\'                           { return 'STRING_LITERAL' }

"/all"                                     { return 'FP_ALL' }
"/any"                                     { return 'FP_ANY' }

"/"                                        { return 'FP_SEPARATOR' }
","                                        { return 'LIST_SEPARATOR' }
"."                                        { return 'FLOAT_SEPARATOR' }
"("                                        { return 'GROUP_OPEN' }
")"                                        { return 'GROUP_CLOSE' }
":"                                        { return 'LAMBDA' }

\s+                                        /* skip whitespace */

<<EOF>>                                    { return 'EOF' }

/lex

%token TRUE FALSE
%right NOT
%left AND OR
%left GREATER_THAN LOWER_THAN GREATER_OR_EQUAL LOWER_OR_EQUAL EQUAL NOT_EQUAL
%token NULL_LITERAL NOT_A_NUMBER_LITERAL NEGATIVE_INFINITY_LITERAL POSITIVE_INFINITY_LITERAL
%token FN_SEARCH_IN FN_SEARCH_ISMATCHSCORING FN_SEARCH_ISMATCH
%token QUERY_TYPE SEARCH_MODE
%token IDENTIFIER FLOAT_LITERAL INTEGER_LITERAL STRING_LITERAL
%token FP_ALL FP_ANY
%left FP_SEPARATOR LIST_SEPARATOR FLOAT_SEPARATOR
%token GROUP_OPEN GROUP_CLOSE
%left LAMBDA

%parse-param ast deps fns

%ebnf

%start filter_expression

%%

/* Top-level rules */
filter_expression
    : boolean_expression EOF
    { yy.ast.value = $1 }
    ;

/* Shared base rules */
boolean_expression
    : collection_filter_expression
    | logical_expression
    | comparison_expression
    | boolean_literal
    | boolean_function_call
    | GROUP_OPEN boolean_expression GROUP_CLOSE
    { $$ = { type: "GROUP_EXPRESSION", value: $2 } }
    | variable
    ;

/* This can be a range variable in the case of a lambda, or a field path. */
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
    | IDENTIFIER        { $$ = { type: "IDENTIFIER", value: $1 } }
    ;
collection_filter_expression
    : variable FP_ALL GROUP_OPEN lambda_expression GROUP_CLOSE
    { $$ = { type: "ALL_FILTER", target: $1, expression: $4 } }
    | variable FP_ANY GROUP_OPEN lambda_expression GROUP_CLOSE
    { $$ = { type: "ANY_FILTER", target: $1, expression: $4 } }
    | variable FP_ANY GROUP_OPEN GROUP_CLOSE
    { $$ = { type: "ANY_FILTER", target: $1 } }
    ;
lambda_expression
    : IDENTIFIER LAMBDA boolean_expression     { $$ = { type: "LAMBDA", params: [{ type: "IDENTIFIER", value: $1 }], expression: $3 } }
    ;
logical_expression
    : boolean_expression AND boolean_expression
    {
        $$ = {
            type: "AND_EXPRESSION",
            left: $1,
            right: $3,
        }
    }
    | boolean_expression OR boolean_expression
    {
        $$ = {
            type: "OR_EXPRESSION",
            left: $1,
            right: $3,
        }
    }
    | NOT boolean_expression    { $$ = { type: "NOT_EXPRESSION", value: $2 } }
    ;
comparison_expression
    : variable_or_function comparison_operator constant
    {
        $$ = {
            type: "COMPARISON",
            left: $1,
            op: $2,
            right: $3,
        }
    }
    | constant comparison_operator variable_or_function
    {
        $$ = {
            type: "COMPARISON",
            left: $1,
            op: $2,
            right: $3,
        }
    }
    ;
comparison_operator
    : GREATER_THAN
    | LOWER_THAN
    | GREATER_OR_EQUAL
    | LOWER_OR_EQUAL
    | EQUAL
    | NOT_EQUAL
    ;
variable_or_function
    : variable          { $$ = $1 }
//     | function_call
    ;

/* Rules for constants and literals */

constant
    : string_literal
    | date_time_offset_literal
    | integer_literal
    | float_literal
    | boolean_literal
    | null_literal
    ;
string_literal
    : STRING_LITERAL            { $$ = { type: "STRING", value: $1.slice(1, -1) } }
    ;
date_time_offset_literal
    : DATE_TIME_OFFSET_LITERAL  { $$ = { type: "DATETIMEOFFSET", value: new Date($1) } }
    ;
integer_literal
    : INTEGER_LITERAL           { $$ = { type: "INTEGER", value: parseInt($1, 10) } }
    ;
float_literal
    : FLOAT_LITERAL                 { $$ = { type: "FLOAT", value: parseFloat($1) } }
    | NOT_A_NUMBER_LITERAL          { $$ = { type: "NOT_A_NUMBER" } }
    | NEGATIVE_INFINITY_LITERAL     { $$ = { type: "NEGATIVE_INFINITY" } }
    | POSITIVE_INFINITY_LITERAL     { $$ = { type: "POSITIVE_INFINITY" } }
    ;
boolean_literal
    : TRUE      { $$ = { type: "BOOLEAN", value: true } }
    | FALSE     { $$ = { type: "BOOLEAN", value: false } }
    ;
null_literal
    : NULL_LITERAL              { $$ = { type: "NULL" } }
    ;

/* Rules for functions */

// function_call
//     : geo_distance_call
//     | boolean_function_call
//     ;
// geo_distance_call
//     : 'geo.distance(' variable ',' geo_point ')'
//     | 'geo.distance(' geo_point ',' variable ')'
//     ;
// geo_point
//     : "geography'POINT(" lon_lat ")'"
//     ;
// lon_lat
//     : float_literal ' ' float_literal
//     ;
boolean_function_call
//     : geo_intersects_call
    : search_in_call
    | search_is_match_call
    ;
// geo_intersects_call
//     : 'geo.intersects(' variable ',' geo_polygon ')'
//     ;
// /* You need at least four points to form a polygon, where the first and
// last points are the same. */
// geo_polygon
//     : "geography'POLYGON((" lon_lat ',' lon_lat ',' lon_lat ',' lon_lat_list "))'"
//     ;
// lon_lat_list
//     : lon_lat(',' lon_lat)*
//     ;
search_in_call
    : FN_SEARCH_IN GROUP_OPEN search_in_parameters GROUP_CLOSE
    { $$ = { type: "FN_SEARCH_IN", ...$3 } }
    ;
search_in_parameters
    : variable LIST_SEPARATOR string_literal
    { $$ = {
        variable: $1,
        valueList: $3,
    } }
    | variable LIST_SEPARATOR string_literal LIST_SEPARATOR string_literal
    { $$ = {
        variable: $1,
        valueList: $3,
        delimiters: $5,
    } }
    ;
/* Note that it is illegal to call search.ismatch or search.ismatchscoring
from inside a lambda expression. */
search_is_match_call
    : FN_SEARCH_ISMATCH GROUP_OPEN search_is_match_parameters GROUP_CLOSE
    { $$ = { type: "FN_SEARCH_ISMATCH", ...$3 } }
    | FN_SEARCH_ISMATCHSCORING GROUP_OPEN search_is_match_parameters GROUP_CLOSE
    { $$ = { type: "FN_SEARCH_ISMATCHSCORING", ...$3 } }
    ;
search_is_match_parameters
    : string_literal
    { $$ = {
        search: $1,
    } }
    | string_literal LIST_SEPARATOR string_literal
    { $$ = {
        search: $1,
        searchFields: $3,
    } }
    | string_literal LIST_SEPARATOR string_literal LIST_SEPARATOR QUERY_TYPE LIST_SEPARATOR SEARCH_MODE
    { $$ = {
        search: $1,
        searchFields: $3,
        queryType: $5.slice(1, -1),
        searchMode: $7.slice(1, -1),
    } }
    ;
