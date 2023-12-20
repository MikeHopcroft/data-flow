import {assert} from 'chai';
import 'mocha';

import {ASTLiteral, Context, parseLiteral} from '../../src/lib2';
import {TokenPosition} from 'typescript-parsec';

type Group = {name: string; cases: Case[]};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Case = {name: string; input: string; expected: any};

describe('Parser2', () => {
  // it('test', () => {
  //   const a = new ASTLiteral(1, position);
  //   const b = new ASTLiteral(1, position);
  //   assert.deepEqual(a, b);
  // });

  const groups: Group[] = [
    {
      name: 'Primitives',
      cases: [
        {name: 'boolean true', input: 'true', expected: true},
        {name: 'boolean false', input: 'false', expected: false},
        {name: 'number - basic', input: '123.456', expected: 123.456},
        {name: 'number - positive', input: '+456', expected: 456},
        {name: 'number - negative', input: '-789', expected: -789},
        // TODO: scientific notation
        {
          name: 'string - double quote',
          input: '"Hello, \\" world"',
          expected: 'Hello, \\" world',
        },
        {
          name: 'string - single quote',
          input: "'Hello, \\' world'",
          expected: "Hello, \\' world",
        },
        // TODO: other character escape sequences

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
      ],
    },
    {
      name: 'Keywords',
      cases: [
        // TODO: return
        // TODO: use
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

  const context = new Context(
    {
      x: 123,
      a: {b: {c: 1010}},
      b: [1, 2, 3],
      f: (a: number, b: number) => a + b,
      g: (a: number, b: number) => ({a, b}),
    },
    {y: new ASTLiteral(456, position)}
  );

  for (const group of groups) {
    describe(group.name, () => {
      for (const {name, input, expected} of group.cases) {
        it(name, async () => {
          const observed = await parseLiteral(input).eval(context);
          assert.deepEqual(observed, expected);
        });
      }
    });
  }
});
