import {assert} from 'chai';
import dedent from 'dedent';
import 'mocha';
import z from 'zod';

import {
  ASTLiteral,
  Action,
  Context,
  parse,
  parseExpression,
} from '../../src/lib';
import {TokenPosition} from 'typescript-parsec';

type Group = {name: string; cases: Case[]};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Case = {name: string; input: string; expected: any};

describe('Parser', () => {
  const groups: Group[] = [
    {
      name: 'Primitives',
      cases: [
        {name: 'boolean - true', input: 'true', expected: true},
        {name: 'boolean - false', input: 'false', expected: false},
        {name: 'number - basic', input: '123.456', expected: 123.456},
        {name: 'number - positive', input: '+456', expected: 456},
        {name: 'number - negative', input: '-789', expected: -789},
        {name: 'number - decimal', input: '.789', expected: 0.789},
        {name: 'number - negative exponent', input: '123e-4', expected: 123e-4},
        {
          name: 'number - positive exponent',
          input: '-1.234e+5',
          expected: -1.234e5,
        },
        {
          name: 'string - double quote',
          input: '"Hello, \\" world"',
          expected: 'Hello, " world',
        },
        {
          name: 'string - single quote',
          input: "'Hello, \\' world'",
          expected: "Hello, ' world",
        },
        {
          name: 'string - escape characters',
          input: "'Hello, \\'\\n world'",
          expected: "Hello, '\n world",
        },
        // TODO: other character escape sequences
        {name: 'undefined', input: 'undefined', expected: undefined},
        {name: 'null', input: 'null', expected: null},

        //
        // Tuple literals
        //
        {name: 'tuple - empty', input: '[]', expected: []},
        {
          name: 'tuple - basic',
          input: '[1, false, "hello"]',
          expected: [1, false, 'hello'],
        },
        {
          name: 'tuple - nested',
          input: '[123, "hello", true, [false, [1]]]',
          expected: [123, 'hello', true, [false, [1]]],
        },
        {
          name: 'tuple - complex',
          input: '[x, "hello", true, [a, [f(1000, 234)]]]',
          expected: [123, 'hello', true, [{b: {c: 1010}}, [1234]]],
        },

        //
        // Object literals
        //
        {name: 'object - empty', input: '{}', expected: {}},
        {name: 'object - one prop', input: '{a: 1}', expected: {a: 1}},
        {
          name: 'object - two props',
          input: '{a: 1, b: true}',
          expected: {a: 1, b: true},
        },
        {
          name: 'object - nested',
          input: '{a: 1, b:{c: "hello"}}',
          expected: {a: 1, b: {c: 'hello'}},
        },
        {
          name: 'object - complex',
          input: '{a: g(5, 6), b:{c: "hello"}}',
          expected: {a: {a: 5, b: 6}, b: {c: 'hello'}},
        },
      ],
    },
    {
      name: 'Identifiers',
      cases: [
        {name: 'not alias', input: 'x', expected: 123},
        {name: 'alias', input: 'y', expected: 456},
      ],
    },
    {
      name: 'Template literals',
      cases: [
        {name: 'degenerate', input: '`hello`', expected: 'hello'},
        {
          name: 'one expression',
          input: '`hello ${123} times.`',
          expected: 'hello 123 times.',
        },
        {
          name: 'two expressions',
          input: '`hello ${123} times. f(1,1)=${f(1,1)}!`',
          expected: 'hello 123 times. f(1,1)=2!',
        },
      ],
    },
    {
      name: 'Operators',
      cases: [
        {name: 'function call', input: 'f(1,2)', expected: 3},
        {name: 'function call - complex', input: 'f(x,f(5, 2))', expected: 130},
        {name: 'dot', input: 'a.b', expected: {c: 1010}},
        {name: 'dot dot', input: 'a.b.c', expected: 1010},
        {name: 'g(1,2).b', input: 'g(1,2).b', expected: 2},
        {name: 'array index', input: 'b[1]', expected: 2},
        {name: 'array index - complex', input: 'b[f(1,1)]', expected: 3},
        {name: 'combination1', input: 'f(g(5,6).a,f(5, 2))', expected: 12},
        // The folling case was identified while implementing tokenization for templates.
        {name: 'combination2', input: 'back.departs(123)', expected: 124},
      ],
    },
  ];

  const position: TokenPosition = {
    index: 0,
    rowBegin: 0,
    columnBegin: 0,
    rowEnd: 0,
    columnEnd: 0,
  };

  const globals = {
    x: 123,
    a: {b: {c: 1010}},
    b: [1, 2, 3],
    back: {departs: (a: number) => a + 1},
    f: (a: number, b: number) => a + b,
    g: (a: number, b: number) => ({a, b}),
  };
  const context = Context.create(
    globals,
    [
      [globals.f, z.tuple([z.number(), z.number()])],
      [globals.g, z.tuple([z.number(), z.number()])],
      [globals.back.departs, z.tuple([z.number()])],
    ],
    {y: new ASTLiteral(456, position)}
  );

  for (const group of groups) {
    describe(group.name, () => {
      for (const {name, input, expected} of group.cases) {
        it(name, async () => {
          const observed = await parseExpression(input).eval(context);
          assert.deepEqual(observed, expected);
        });
      }
    });
  }

  describe('Program', () => {
    const groups: Group[] = [
      {
        name: 'Return',
        cases: [
          {
            name: 'No aliases',
            input: 'return 123;',
            expected: {action: Action.Return, value: 123},
          },
          {
            name: 'Alias chain',
            input: dedent`
              a = 123;
              b = 456;
              c = f(a,b);
              return c;
            `,
            expected: {action: Action.Return, value: 579},
          },
        ],
      },
      {
        name: 'Use',
        cases: [
          {
            name: 'No aliases',
            input: 'use 123;',
            expected: {action: Action.Use, value: 123},
          },
          {
            name: 'Alias chain',
            input: dedent`
              a = 123;
              b = 456;
              c = f(a,b);
              use c;
            `,
            expected: {action: Action.Use, value: 579},
          },
        ],
      },
      {
        name: 'Return - no semicolons',
        cases: [
          {
            name: 'No aliases',
            input: 'return 123',
            expected: {action: Action.Return, value: 123},
          },
          {
            name: 'Alias chain',
            input: dedent`
              a = 123
              b = 456
              c = f(a,b)
              return c
            `,
            expected: {action: Action.Return, value: 579},
          },
        ],
      },
    ];

    const globals = {
      x: 123,
      a: {b: {c: 1010}},
      b: [1, 2, 3],
      f: (a: number, b: number) => a + b,
      g: (a: number, b: number) => ({a, b}),
    };

    for (const group of groups) {
      describe(group.name, () => {
        for (const {name, input, expected} of group.cases) {
          it(name, async () => {
            const node = await parse(input);
            const context = Context.create(
              globals,
              [
                [globals.f, z.array(z.number(), z.number())],
                [globals.g, z.array(z.number(), z.number())],
              ],
              {}
            );
            const value = await node.eval(context);
            const observed = {action: node.action, value};
            assert.deepEqual(observed, expected);
          });
        }
      });
    }
  });
});
