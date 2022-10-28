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

%parse-param ast deps fns

%ebnf

%start select_expression

%%

/* Top-level rules */
select_expression
    : EOF
    {
        yy.ast.type = "LIST";
        yy.ast.value = [];
        yy.ast.canApply = () => [];
        yy.ast.apply = (input) => ({});
    }
    | WILDCARD EOF
    {
        yy.ast.type = "WILDCARD";
        yy.ast.canApply = () => [];
        yy.ast.apply = (input) => input;
    }
    | variable (LIST_SEPARATOR variable)* EOF
    {
        //
        {
        const { mergeDeep, mergeSequence } = yy.deps;
        const keys = [$1, ...$2.map(([sep, clause]) => clause)];
        const canApply = (schema, require) => keys
            .reduce((acc, cur) => [...acc, ...cur.canApply(schema, require)], []);
        const apply = (input) => keys
            .reduce((acc, cur) => mergeDeep(
                    acc,
                    cur.apply(input),
                    { arrayMerge: mergeSequence }
                ),
                {}
            );

        yy.ast.type = "LIST";
        yy.ast.value = keys;
        yy.ast.canApply = canApply;
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
        const { getStruct, matchSchema } = yy.deps;
        const value = [$1, ...$2.map(([sep, node]) => node)];
        const canApply = (schema, require) => matchSchema(schema, require, value);
        const apply = (input) => getStruct(input, value);
        $$ = { type: "FIELD_PATH", value, canApply, apply };
        }
    }
    | IDENTIFIER
    {
        //
        {
        const { matchSchema } = yy.deps;
        const value = $1;
        const canApply = (schema, require) => matchSchema(schema, require, [value]);
        const apply = (input) => ({ [value]: input[value] });
        $$ = { type: "IDENTIFIER", value, canApply, apply };
        }
    }
    ;
