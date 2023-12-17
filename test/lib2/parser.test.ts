import {assert} from 'chai';
import 'mocha';

import {ASTLiteral, Context, parseLiteral} from '../../src/lib2';
import {TokenPosition} from 'typescript-parsec';

type Group = {name: string; cases: Case[]};
type Case = {name: string; input: string; expected: any};

describe('Parser2', () => {
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
        // TODO: object literals
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
      name: 'Operators',
      cases: [
        {name: 'function call', input: 'f(1,2)', expected: 3},
        {name: 'dot', input: 'a.b', expected: {c: 1010}},
        {name: 'dot dot', input: 'a.b.c', expected: 1010},
        {name: 'g(1,2).b', input: 'g(1,2).b', expected: 2},
      ],
    },
    {
      name: 'Keywords',
      cases: [
        // return
        // use
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