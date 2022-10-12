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

%parse-param ast deps fns

%ebnf

%start order_by_expression

%%

/* Top-level rules */
order_by_expression
    : order_by_clause (LIST_SEPARATOR order_by_clause)* EOF
    {
        //
        {
        const { mergeDeep, mergeSequence } = yy.deps;
        const keys = [$1, ...$2.map(([sep, clause]) => clause)];
        const canApply = (schema, require) => keys
            .reduce((acc, cur) => [...acc, ...cur.canApply(schema, require)], []);
        const apply = (left, right) => {
            for (const key of keys) {
                const result = key.apply(left, right);
                if (result !== 0) {
                    return result;
                }
            }
            return 0;
        };

        yy.ast.value = { type: "LIST", value: keys };
        yy.ast.canApply = canApply;
        yy.ast.apply = apply;
        }
    }
    ;

order_by_clause
    : variable (ORDER_ASCENDING | ORDER_DESCENDING)?
    {
        //
        {
        const target = $1;
        const direction = $2 || "asc";
        const canApply = target.canApply;
        const apply = (left, right) => direction === 'desc' ? target.apply(right, left) : target.apply(left, right);
        $$ = { type: "ORDER", target, direction, canApply, apply };
        }
    }
    | sortable_function (ORDER_ASCENDING | ORDER_DESCENDING)?
    {
        //
        {
        const target = $1;
        const direction = $2 || "asc";
        const canApply = target.canApply;
        const apply = (left, right) => direction === 'desc' ? target.apply(right, left) : target.apply(left, right);
        $$ = { type: "ORDER", target, direction, canApply, apply };
        }
    }
    ;
sortable_function
//     : geo_distance_call
    : FN_SEARCH_SCORE GROUP_OPEN GROUP_CLOSE    {
        //
        {
        const { compare } = yy.deps;
        const fn_search_score = yy.fns.fn_search_score;
        const canApply = () => [];
        const apply = (left, right) => compare(fn_search_score(left), fn_search_score(right));
        $$ = { type: "FN_SEARCH_SCORE", canApply, apply };
        }
    }
    ;

/* Shared base rules */
variable
    : IDENTIFIER (FP_SEPARATOR IDENTIFIER)+
    {
        //
        {
        const { compare, getValue, matchSchema } = yy.deps;
        const value = [$1, ...$2.map(([sep, node]) => node)];
        const canApply = (schema, require) => matchSchema(schema, require, value);
        const apply = (left, right) => compare(getValue(left, value), getValue(right, value));
        $$ = { type: "FIELD_PATH", value, canApply, apply };
        }
    }
    | IDENTIFIER
    {
        //
        {
        const { compare, matchSchema } = yy.deps;
        const value = $1;
        const canApply = (schema, require) => matchSchema(schema, require, value);
        const apply = (left, right) => compare(left[value], right[value]);
        $$ = { type: "IDENTIFIER", value, canApply, apply };
        }
    }
    ;