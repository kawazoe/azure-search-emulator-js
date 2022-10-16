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
    {
        for (const k in $1) {
            yy.ast[k] = $1[k];
        }
    }
    ;

/* Shared base rules */
boolean_expression
    : collection_filter_expression
    | logical_expression
    | comparison_expression
    | boolean_literal
    {
        const literal = $1;
        $$ = { ...literal, canApply: () => [], apply: () => literal.value };
    }
    | boolean_function_call
    | GROUP_OPEN boolean_expression GROUP_CLOSE
    {
        $$ = { type: "GROUP_EXPRESSION", value: $2, canApply: $2.canApply, apply: $2.apply };
    }
    | variable
    ;

/* This can be a range variable in the case of a lambda, or a field path. */
variable
    : IDENTIFIER (FP_SEPARATOR IDENTIFIER)+
    {
        //
        {
        const { getValue, matchSchema } = yy.deps;
        const value = [$1, ...$2.map(([sep, node]) => node)];
        const canApply = (schema, require) => matchSchema(schema, require, value);
        const apply = (input) => getValue(input, value);
        $$ = { type: "FIELD_PATH", value, canApply, apply };
        }
    }
    | IDENTIFIER
    {
        //
        {
        const { getValue, matchSchema } = yy.deps;
        const value = $1;
        const canApply = (schema, require) => matchSchema(schema, require, [value]);
        const apply = (input) => input[value];
        $$ = { type: "IDENTIFIER", value, canApply, apply };
        }
    }
    ;
collection_filter_expression
    : variable FP_ALL GROUP_OPEN lambda_expression GROUP_CLOSE
    {
        //
        {
        const target = $1;
        const expression = $4;
        const canApply = target.canApply;
        const apply = (input) => {
            const collection = target.apply(input);
            if (!Array.isArray(collection)) {
                throw new Error(`Expected ${target.value} to be a collection but got ${collection} instead.`);
            }
            return collection.every(expression.apply)
                ? collection.length
                : 0;
        };
        $$ = { type: "ALL_FILTER", target, expression, canApply, apply };
        }
    }
    | variable FP_ANY GROUP_OPEN lambda_expression GROUP_CLOSE
    {
        //
        {
        const target = $1;
        const expression = $4;
        const canApply = target.canApply;
        const apply = (input) => {
            const collection = target.apply(input);
            if (!Array.isArray(collection)) {
                throw new Error(`Expected ${target.value} to be a collection but got ${collection} instead.`);
            }
            return collection.filter(expression.apply).length;
        };
        $$ = { type: "ANY_FILTER", target, expression, canApply, apply };
        }
    }
    | variable FP_ANY GROUP_OPEN GROUP_CLOSE
    {
        //
        {
        const target = $1;
        const canApply = target.canApply;
        const apply = (input) => {
            const collection = target.apply(input);
            if (!Array.isArray(collection)) {
                throw new Error(`Expected ${target.value} to be a collection but got ${collection} instead.`);
            }
            return collection.length;
        };
        $$ = { type: "ANY_FILTER", target, canApply, apply };
        }
    }
    ;
lambda_expression
    : IDENTIFIER LAMBDA boolean_expression
    {
        //
        {
        const value = $1;
        const expression = $3;
        const canApply = (schema, require) => [...value.canApply(schema, require), ...expression.canApply(schema, require)];
        const apply = (input) => expression.apply({ [value]: input });
        $$ = { type: "LAMBDA", params: [{ type: "IDENTIFIER", value }], expression, canApply, apply };
        }
    }
    ;
logical_expression
    : boolean_expression AND boolean_expression
    {
        //
        {
        const left = $1;
        const right = $3;
        const canApply = (schema, require) => [...left.canApply(schema, require), ...right.canApply(schema, require)];
        const apply = (input) => left.apply(input) * right.apply(input) * 2;
        $$ = { type: "AND_EXPRESSION", left, right, canApply, apply };
        }
    }
    | boolean_expression OR boolean_expression
    {
        //
        {
        const left = $1;
        const right = $3;
        const canApply = (schema, require) => [...left.canApply(schema, require), ...right.canApply(schema, require)];
        const apply = (input) => left.apply(input) + right.apply(input);
        $$ = { type: "OR_EXPRESSION", left, right, canApply, apply };
        }
    }
    | NOT boolean_expression
    {
        //
        {
        const value = $2;
        const canApply = value.canApply;
        const apply = (input) => value.apply(input) + 1;
        $$ = { type: "NOT_EXPRESSION", value, canApply, apply };
        }
    }
    ;
comparison_expression
    : variable_or_function comparison_operator constant
    {
        //
        {
        const left = $1;
        const op = $2;
        const right = $3;
        const canApply = left.canApply;
        const apply = (input) => op.apply(left.apply(input), right.value);
        $$ = { type: "COMPARISON", left, op: op.kind, right, canApply, apply };
        }
    }
    | constant comparison_operator variable_or_function
    {
        //
        {
        const left = $1;
        const op = $2;
        const right = $3;
        const canApply = right.canApply;
        const apply = (input) => op.apply(left.value, right.apply(input));
        $$ = { type: "COMPARISON", left, op: op.kind, right, canApply, apply };
        }
    }
    ;
comparison_operator
    : GREATER_THAN      { $$ = { kind: $1, apply: (l, r) => l > r ? 1 : 0 } }
    | LOWER_THAN        { $$ = { kind: $1, apply: (l, r) => l < r ? 1 : 0 } }
    | GREATER_OR_EQUAL  { $$ = { kind: $1, apply: (l, r) => l >= r ? 1 : 0 } }
    | LOWER_OR_EQUAL    { $$ = { kind: $1, apply: (l, r) => l <= r ? 1 : 0 } }
    | EQUAL             { $$ = { kind: $1, apply: (l, r) => l == r ? 1 : 0 } }
    | NOT_EQUAL         { $$ = { kind: $1, apply: (l, r) => l != r ? 1 : 0 } }
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
    | NOT_A_NUMBER_LITERAL          { $$ = { type: "NOT_A_NUMBER", value: Number.NaN } }
    | NEGATIVE_INFINITY_LITERAL     { $$ = { type: "NEGATIVE_INFINITY", value: Number.NEGATIVE_INFINITY } }
    | POSITIVE_INFINITY_LITERAL     { $$ = { type: "POSITIVE_INFINITY", value: Number.POSITIVE_INFINITY } }
    ;
boolean_literal
    : TRUE      { $$ = { type: "BOOLEAN", value: true } }
    | FALSE     { $$ = { type: "BOOLEAN", value: false } }
    ;
null_literal
    : NULL_LITERAL              { $$ = { type: "NULL", value: null } }
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
    {
        //
        {
        const { fn_search_in } = yy.fns;
        const variable = $1;
        const valueList = $3;
        const canApply = variable.canApply;
        const apply = (input) => fn_search_in(input, variable, valueList.value);
        $$ = { variable, valueList, canApply, apply };
        }
    }
    | variable LIST_SEPARATOR string_literal LIST_SEPARATOR string_literal
    {
        //
        {
        const { fn_search_in } = yy.fns;
        const variable = $1;
        const valueList = $3;
        const delimiter = $5;
        const canApply = variable.canApply;
        const apply = (input) => fn_search_in(input, variable, valueList.value, delimiter.value);
        $$ = { variable, valueList, delimiter, canApply, apply };
        }
    }
    ;
/* Note that it is illegal to call search.ismatch or search.ismatchscoring
from inside a lambda expression. */
search_is_match_call
    : FN_SEARCH_ISMATCH GROUP_OPEN search_is_match_parameters GROUP_CLOSE
    {
        //
        {
        const { fn_search_ismatch } = yy.fns;
        const parameters = $3;
        const canApply = () => [];
        const apply = (input) => parameters.apply(input, fn_search_ismatch);
        $$ = { type: "FN_SEARCH_ISMATCH", ...parameters, apply };
        }
    }
    | FN_SEARCH_ISMATCHSCORING GROUP_OPEN search_is_match_parameters GROUP_CLOSE
    {
        //
        {
        const { fn_search_ismatchscoring } = yy.fns;
        const parameters = $3;
        const canApply = () => [];
        const apply = (input) => parameters.apply(input, fn_search_ismatchscoring);
        $$ = { type: "FN_SEARCH_ISMATCHSCORING", ...parameters, apply };
        }
    }
    ;
search_is_match_parameters
    : string_literal
    {
        //
        {
        const search = $1;
        const canApply = () => [];
        const apply = (input, fn) => fn(input, search.value);
        $$ = { search, apply };
        }
    }
    | string_literal LIST_SEPARATOR string_literal
    {
        //
        {
        const search = $1;
        const searchFields = $3;
        const canApply = () => [];
        const apply = (input, fn) => fn(input, search.value, searchFields.value);
        $$ = { search, searchFields, apply };
        }
    }
    | string_literal LIST_SEPARATOR string_literal LIST_SEPARATOR QUERY_TYPE LIST_SEPARATOR SEARCH_MODE
    {
        //
        {
        const search = $1;
        const searchFields = $3;
        const queryType = $5.slice(1, -1);
        const searchMode = $7.slice(1, -1);
        const canApply = () => [];
        const apply = (input, fn) => fn(input, search.value, searchFields.value, queryType, searchMode);
        $$ = { search, searchFields, queryType, searchMode, apply };
        }
    }
    ;
