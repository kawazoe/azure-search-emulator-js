import { filter as parser } from './dist/azure-search-emulator.es.js';

console.log('='.repeat(70));

let passed = 0;
let failed = 0;
function test(raw, target) {
    const pad = (str, c, max) => str + (c.repeat(max).substring(0, max - str.length));
    const message = (kind, ...rest) => console[kind](pad(`It should convert "${raw}"`, ' ', 60), ...rest);

    try {
        const ast = {};
        parser.parse(raw, ast);

        const actual = JSON.stringify(ast.value);
        const expected = JSON.stringify(target)

        if (actual === expected) {
            // message('info', 'PASS!');
        } else {
            message('error', `FAILED!\n\nE: ${expected}\nA: ${actual}\n`);
            ++failed;
            return;
        }
    } catch (e) {
        message('error', 'FAILED!\n\n', e, '\n\n');
        ++failed;
        return;
    }

    ++passed;
}

const fieldPathAst = (...value) => ({ type: "FIELD_PATH", value });
const identifierAst = (value) => ({ type: "IDENTIFIER", value });
const comparisonAst = (left, op, right) => ({ type: "COMPARISON", left, op, right });
    const stringAst = (value) => ({ type: "STRING", value });
    const datetimeOffsetAst = (value) => ({ type: "DATETIMEOFFSET", value });
    const integerAst = (value) => ({ type: "INTEGER", value });
    const floatAst = (value) => ({ type: "FLOAT", value });
    const nanAst = () => ({ type: "NOT_A_NUMBER" });
    const posInfAst = () => ({ type: "POSITIVE_INFINITY" });
    const negInfAst = () => ({ type: "NEGATIVE_INFINITY" });
    const booleanAst = (value) => ({ type: "BOOLEAN", value });
    const nullAst = () => ({ type: "NULL" });
const andExpressionAst = (left, right) => ({ type: "AND_EXPRESSION", left, right });
const orExpressionAst = (left, right) => ({ type: "OR_EXPRESSION", left, right });
const notExpressionAst = (value) => ({ type: "NOT_EXPRESSION", value });
const groupAst = (value) => ({ type: "GROUP_EXPRESSION", value });
const lambdaAst = (params, expression) => ({ type: "LAMBDA", params, expression });
const allFilterAst = (target, expression) => ({ type: "ALL_FILTER", target, expression });
const anyFilterAst = (target, expression) => ({ type: "ANY_FILTER", target, expression });
const searchInAst = (variable, valueList, delimiters) => ({ type: "FN_SEARCH_IN", variable, valueList, delimiters });
const searchIsMatchAst = (search, searchFields, queryType, searchMode) => ({ type: "FN_SEARCH_ISMATCH", search, searchFields, queryType, searchMode });
const searchIsMatchScoringAst = (search, searchFields, queryType, searchMode) => ({ type: "FN_SEARCH_ISMATCHSCORING", search, searchFields, queryType, searchMode });

const constants = [
    ["'foobar'", stringAst("foobar")],
    ["''", stringAst("")],
    ["'4'", stringAst("4")],
    ["'4.0'", stringAst("4.0")],
    ["'true'", stringAst("true")],
    ["'null'", stringAst("null")],
    ["'1970-01-01T00:00:00-05:30'", stringAst("1970-01-01T00:00:00-05:30")],
    ["'a/b'", stringAst("a/b")],

    ["1970-01-02T00:00:00Z", datetimeOffsetAst(new Date("1970-01-02T00:00:00Z"))],
    ["1970-01-01T01:02:03Z", datetimeOffsetAst(new Date("1970-01-01T01:02:03Z"))],
    ["1970-01-01T00:00:00+05:30", datetimeOffsetAst(new Date("1970-01-01T00:00:00+0530"))],
    ["1970-01-01T00:00:00-05:30", datetimeOffsetAst(new Date("1970-01-01T00:00:00-0530"))],

    ["0", integerAst(0)],
    ["-0", integerAst(-0)],
    ["4", integerAst(4)],
    ["-4", integerAst(-4)],
    ["42", integerAst(42)],
    ["-42", integerAst(-42)],

    ["NaN", nanAst()],
    ["INF", posInfAst()],
    ["-INF", negInfAst()],
    ["0.0", floatAst(0)],
    ["-0.0", floatAst(-0)],
    ["+0.0", floatAst(0)],
    ["0.0e-0", floatAst(0)],
    ["0.0e+0", floatAst(0)],
    ["1.2", floatAst(1.2)],
    ["-1.2", floatAst(-1.2)],
    ["+1.2", floatAst(1.2)],
    ["1.2e-3", floatAst(0.0012)],
    ["1.2e+3", floatAst(1200)],

    ["true", booleanAst(true)],
    ["false", booleanAst(false)],

    ["null", nullAst()],
];
const operators = [
    "gt",
    "lt",
    "ge",
    "le",
    "eq",
    "ne",
];
const variables = [
    ["f", identifierAst("f")],
    ["F", identifierAst("F")],
    ["_", identifierAst("_")],
    ["foo", identifierAst("foo")],
    ["foo00", identifierAst("foo00")],
    ["foo_00", identifierAst("foo_00")],

    ["a/b", fieldPathAst("a", "b")],
    ["a/b/c", fieldPathAst("a", "b", "c")],
]

const unaryExpressions = [
    ["not true", notExpressionAst(booleanAst(true))],
    ["not not true", notExpressionAst(notExpressionAst(booleanAst(true)))],
    ["not foo gt 0", notExpressionAst(comparisonAst(
        identifierAst("foo"),
        "gt",
        integerAst(0),
    ))],
    ["not foo/bar gt 0", notExpressionAst(comparisonAst(
        fieldPathAst("foo", "bar"),
        "gt",
        integerAst(0),
    ))],
];
const binaryExpressions = [
    ["true and true", andExpressionAst(booleanAst(true), booleanAst(true))],
    ["true and false", andExpressionAst(booleanAst(true), booleanAst(false))],
    ["4.0 gt f and true", andExpressionAst(
        comparisonAst(floatAst(4.0), "gt", identifierAst("f")),
        booleanAst(true),
    )],
    ["4.0 gt f and f/b eq 0", andExpressionAst(
        comparisonAst(floatAst(4.0), "gt", identifierAst("f")),
        comparisonAst(fieldPathAst("f", "b"), "eq", integerAst(0)),
    )],

    ["true or true", orExpressionAst(booleanAst(true), booleanAst(true))],
    ["true or false", orExpressionAst(booleanAst(true), booleanAst(false))],
    ["4.0 gt f or true", orExpressionAst(
        comparisonAst(floatAst(4.0), "gt", identifierAst("f")),
        booleanAst(true),
    )],
    ["4.0 gt f or f/b eq 0", orExpressionAst(
        comparisonAst(floatAst(4.0), "gt", identifierAst("f")),
        comparisonAst(fieldPathAst("f", "b"), "eq", integerAst(0)),
    )],
];
const groupExpressions = [
    ["(true)", groupAst(booleanAst(true))],
    ["true and (false and true)", andExpressionAst(
        booleanAst(true),
        groupAst(
            andExpressionAst(
                booleanAst(false),
                booleanAst(true),
            )
        ),
    )],
    ["(f/b eq 0)", groupAst(comparisonAst(
        fieldPathAst("f", "b"),
        "eq",
        integerAst(0)
    ))],
    ["true and (f/b eq 0)", andExpressionAst(
        booleanAst(true),
        groupAst(comparisonAst(
            fieldPathAst("f", "b"),
            "eq",
            integerAst(0)
        ))
    )],
    ["(f gt -1) and (f/b eq 0)", andExpressionAst(
        groupAst(comparisonAst(
            identifierAst("f"),
            "gt",
            integerAst(-1)
        )),
        groupAst(comparisonAst(
            fieldPathAst("f", "b"),
            "eq",
            integerAst(0)
        ))
    )],
    ["(f gt -1 and f/b eq 0)", groupAst(andExpressionAst(
        comparisonAst(
            identifierAst("f"),
            "gt",
            integerAst(-1)
        ),
        comparisonAst(
            fieldPathAst("f", "b"),
            "eq",
            integerAst(0)
        )
    ))],
];
const filters = [
    ["f/all(v:true)", allFilterAst(
        identifierAst("f"),
        lambdaAst([identifierAst("v")], booleanAst(true))
    )],
    ["f/any(v:true)", anyFilterAst(
        identifierAst("f"),
        lambdaAst([identifierAst("v")], booleanAst(true))
    )],
    ["f/any()", anyFilterAst(identifierAst("f"))],
    ["f/all(v: v gt 0)", allFilterAst(
        identifierAst("f"),
        lambdaAst([identifierAst("v")], comparisonAst(
            identifierAst("v"),
            "gt",
            integerAst(0),
        ))
    )],
];
const functions = [
    ["search.in(v, '1, 2, 3')", searchInAst(identifierAst("v"), stringAst("1, 2, 3"))],
    ["search.in(v, '1, 2, 3', ', ')", searchInAst(identifierAst("v"), stringAst("1, 2, 3"), stringAst(", "))],
    ["search.ismatch('q')", searchIsMatchAst(stringAst("q"))],
    ["search.ismatch('q', '1, 2, 3')", searchIsMatchAst(stringAst("q"), stringAst("1, 2, 3"))],
    [
        "search.ismatch('q', '1, 2, 3', 'full', 'any')",
        searchIsMatchAst(stringAst("q"), stringAst("1, 2, 3"), "full", "any"),
    ],
    [
        "search.ismatch('q', '1, 2, 3', 'full', 'all')",
        searchIsMatchAst(stringAst("q"), stringAst("1, 2, 3"), "full", "all"),
    ],
    [
        "search.ismatch('q', '1, 2, 3', 'simple', 'any')",
        searchIsMatchAst(stringAst("q"), stringAst("1, 2, 3"), "simple", "any"),
    ],
    [
        "search.ismatch('q', '1, 2, 3', 'simple', 'all')",
        searchIsMatchAst(stringAst("q"), stringAst("1, 2, 3"), "simple", "all"),
    ],
    ["search.ismatchscoring('q')", searchIsMatchScoringAst(stringAst("q"))],
    ["search.ismatchscoring('q', '1, 2, 3')", searchIsMatchScoringAst(stringAst("q"), stringAst("1, 2, 3"))],
    [
        "search.ismatchscoring('q', '1, 2, 3', 'full', 'any')",
        searchIsMatchScoringAst(stringAst("q"), stringAst("1, 2, 3"), "full", "any"),
    ],
    [
        "search.ismatchscoring('q', '1, 2, 3', 'full', 'all')",
        searchIsMatchScoringAst(stringAst("q"), stringAst("1, 2, 3"), "full", "all"),
    ],
    [
        "search.ismatchscoring('q', '1, 2, 3', 'simple', 'any')",
        searchIsMatchScoringAst(stringAst("q"), stringAst("1, 2, 3"), "simple", "any"),
    ],
    [
        "search.ismatchscoring('q', '1, 2, 3', 'simple', 'all')",
        searchIsMatchScoringAst(stringAst("q"), stringAst("1, 2, 3"), "simple", "all"),
    ],

]

console.log('constant op variable');
for (const [leftStr, leftAst] of constants) {
    for (const op of operators) {
        for (const [rightStr, rightAst] of variables) {
            test(`${leftStr} ${op} ${rightStr}`, comparisonAst(leftAst, op, rightAst));
        }
    }
}

console.log('variable op constant');
for (const [leftStr, leftAst] of variables) {
    for (const op of operators) {
        for (const [rightStr, rightAst] of constants) {
            test(`${leftStr} ${op} ${rightStr}`, comparisonAst(leftAst, op, rightAst));
        }
    }
}

console.log('not expression');
for (const [vStr, vAst] of unaryExpressions) {
    test(vStr, vAst);
}

console.log('expression bool expression');
for (const [vStr, vAst] of binaryExpressions) {
    test(vStr, vAst);
}

console.log('group expression');
for (const [vStr, vAst] of groupExpressions) {
    test(vStr, vAst);
}

console.log('variable');
for (const [vStr, vAst] of variables) {
    test(vStr, vAst);
}

console.log('filters');
for (const [vStr, vAst] of filters) {
    test(vStr, vAst);
}

console.log('functions');
for (const [vStr, vAst] of functions) {
    test(vStr, vAst);
}


console.log('='.repeat(70));
console.info('Passed:', passed, 'Failed:', failed);

// console.log("parser productions:", parser.productions.filter(p => p.symbol.includes("field_path")));
// console.log("lexer rules:", parser.lexer.rules);
