%lex

%%

\s+                                        /* skip whitespaces */

\'((\\\')|[^\'])*\'                        {
                                             yytext = yytext
                                               .slice(1, yytext.length - 1)
                                               .replace('\\\'', '\'');
                                             return 'STRING_LITERAL'
                                           }
\"((\\\")|[^\"])*\"                        {
                                             yytext = yytext
                                               .slice(1, yytext.length - 1)
                                               .replace('\\\"', '\"');
                                             return 'STRING_LITERAL'
                                           }

\\(.)|([^\+\-\|\*\(\)\\\s]+)               {
                                             yytext = this.matches[1] || this.matches[2];
                                             return 'TEXT';
                                           }

"*"                                        { return 'OPERATOR_STARTS_WITH' }

"+"                                        { return 'OPERATOR_AND' }
"-"                                        { return 'OPERATOR_NOT' }
"|"                                        { return 'OPERATOR_OR' }

"("                                        { return 'GROUP_OPEN' }
")"                                        { return 'GROUP_CLOSE' }

<<EOF>>                                    { return 'EOF' }

/lex

%token OPERATOR_AND OPERATOR_OR OPERATOR_NOT OPERATOR_STARTS_WITH
%token STRING_LITERAL TEXT
%token GROUP_OPEN GROUP_CLOSE

%parse-param ast searchMode deps

%ebnf

%start query_expression

%%

query_expression
    : expression
    {
        for (const k in $1) {
            yy.ast[k] = $1[k];
        }
    }
    | EOF
    {
        yy.ast.type = "EMPTY"
        yy.ast.analyze = () => ({ query: [], apply: () => [] });
    }
    ;

phrase
    : STRING_LITERAL
    {
        //
        {
        const value = $1;
        const analyze = (analyzeFn) => analyzeFn(value);

        $$ = { type: "QUOTE", value, analyze }
        }
    }
    | TEXT
    {
        //
        {
        const value = $1;
        const analyze = (analyzeFn) => analyzeFn(value);

        $$ = { type: "WORD", value, analyze }
        }
    }
    ;

clause
    : phrase OPERATOR_STARTS_WITH
    {
        //
        {
        const value = $1;
        const analyze = (analyzeFn) => {
            const avalue = value.analyze(analyzeFn);

            return {
                query: avalue.query,
                apply: (ngrams) => avalue.apply(ngrams, 'startsWith'),
            };
        };

        $$ = { type: "PARTIAL", value, analyze }
        }
    }
    | phrase
    {
        //
        {
        const value = $1;
        const analyze = (analyzeFn) => {
            const avalue = value.analyze(analyzeFn);

            return {
                query: avalue.query,
                apply: (ngrams) => avalue.apply(ngrams, 'equals'),
            };
        };

        $$ = { ...value, analyze }
        }
    }
    | exception
    ;

expression
    : GROUP_OPEN expression GROUP_CLOSE     { $$ = $2 }
    | logical_expression
    | clause
    ;

r_expression
    : GROUP_OPEN expression GROUP_CLOSE     { $$ = $2 }
    | clause
    ;

logical_expression
    : expression OPERATOR_NOT r_expression
    {
        //
        {
        const { score } = yy.deps;
        const left = $1;
        const right = $3;
        const analyze = (analyzeFn) => {
            const aleft = left.analyze(analyzeFn);
            const aright = right.analyze(analyzeFn);

            const query = [...aleft.query, ...aright.query];
            const apply = (function () {
                switch (yy.searchMode) {
                    case 'any': return (ngrams) => {
                        const lMatches = aleft.apply(ngrams);
                        const rMatches = aright.apply(ngrams);
                        if (rMatches.length > 0) {
                            return lMatches;
                        }

                        return [
                            ...lMatches,
                            { ['@not']: true, ngrams: aright.query, score: score(ngrams, aright.query) },
                        ];
                    };
                    case 'all': return (ngrams) => {
                        const lMatches = aleft.apply(ngrams);
                        if (lMatches.length === 0) {
                            return [];
                        }

                        const rMatches = aright.apply(ngrams);
                        if (rMatches.length > 0) {
                            return [];
                        }

                        return [
                            ...lMatches,
                            { ['@not']: true, ngrams: aright.query, score: score(ngrams, aright.query) },
                        ];
                    };
                    default:
                        throw new Error(`Unsupported searchMode: ${yy.searchMode}`);
                }
            })();

            return { query, apply };
        };

        $$ = { type: "EXPRESSION", left, op: 'not', right, analyze }
        }
    }
    | expression OPERATOR_AND r_expression
    {
        //
        {
        const left = $1;
        const right = $3;
        const analyze = (analyzeFn) => {
            const aleft = left.analyze(analyzeFn);
            const aright = right.analyze(analyzeFn);

            const query = [...aleft.query, ...aright.query];
            const apply = (ngrams) => {
                const lMatches = aleft.apply(ngrams);
                if (lMatches.length === 0) {
                    return [];
                }

                const rMatches = aright.apply(ngrams);
                if (rMatches.length === 0) {
                    return [];
                }

                return [...lMatches, ...rMatches];
            };

            return { query, apply };
        };

        $$ = { type: "EXPRESSION", left, op: 'and', right, analyze }
        }
    }
    | expression OPERATOR_OR r_expression
    {
        //
        {
        const left = $1;
        const right = $3;
        const analyze = (analyzeFn) => {
            const aleft = left.analyze(analyzeFn);
            const aright = right.analyze(analyzeFn);

            return {
                query: [...aleft.query, ...aright.query],
                apply: (ngrams) => [...aleft.apply(ngrams), ...aright.apply(ngrams)],
            };
        };

        $$ = { type: "EXPRESSION", left, op: 'or', right, analyze }
        }
    }
    | expression r_expression
    {
        //
        {
        const left = $1;
        const right = $2;
        const analyze = (analyzeFn) => {
            const aleft = left.analyze(analyzeFn);
            const aright = right.analyze(analyzeFn);

            return {
                query: [...aleft.query, ...aright.query],
                apply: (ngrams) => [...aleft.apply(ngrams), ...aright.apply(ngrams)],
            };
        };

        $$ = { type: "EXPRESSION", left, op: 'or', right, analyze }
        }
    }
    ;

%%
