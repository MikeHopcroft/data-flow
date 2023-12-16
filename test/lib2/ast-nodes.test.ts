import {assert} from 'chai';
import 'mocha';
import {TokenPosition} from 'typescript-parsec';

import {
  ASTDot,
  ASTFunction,
  ASTIndex,
  ASTLiteral,
  ASTNode,
  ASTObject,
  ASTReference,
  ASTTuple,
  Context,
  RuntimeError,
  RuntimeErrorCode,
  Value,
} from '../../src/lib2';

const globalContext = {
  x: 456,
  y: {z: 789},
  a: ['one', 'two', 'three'],
  f: (a: number, b: number) => a + b,
};
const context = new Context(globalContext, {});

const position: TokenPosition = {
  index: 0,
  rowBegin: 0,
  columnBegin: 0,
  rowEnd: 0,
  columnEnd: 0,
};

describe('ASTNode', () => {
  describe('Basic expressions', () => {
    const cases: {name: string; input: ASTNode<unknown>; expected: Value}[] = [
      {
        name: 'number literal',
        input: new ASTLiteral(123, position),
        expected: 123,
      },
      {
        name: 'string literal',
        input: new ASTLiteral('hello', position),
        expected: 'hello',
      },
      {
        name: 'boolean literal',
        input: new ASTLiteral(true, position),
        expected: true,
      },
      {
        name: 'undefined literal',
        input: new ASTLiteral(undefined, position),
        expected: undefined,
      },
      {
        name: 'object literal',
        input: new ASTObject(
          {
            a: new ASTLiteral(1, position),
            b: new ASTLiteral(2, position),
            c: new ASTLiteral(3, position),
          },
          position
        ),
        expected: {a: 1, b: 2, c: 3},
      },
      {
        name: 'tuple literal',
        input: new ASTTuple(
          [
            new ASTLiteral(1, position),
            new ASTLiteral(2, position),
            new ASTLiteral(3, position),
          ],
          position
        ),
        expected: [1, 2, 3],
      },
      {
        name: 'identifier',
        input: new ASTReference('x', position),
        expected: globalContext.x,
      },
      {
        name: 'dot',
        input: new ASTDot(
          new ASTObject(
            {
              a: new ASTLiteral(1, position),
              b: new ASTLiteral(2, position),
              c: new ASTLiteral(3, position),
            },
            position
          ),
          new ASTReference('b', position),
          position
        ),
        expected: 2,
      },
      {
        name: 'dot dot',
        input: new ASTDot(
          new ASTDot(
            new ASTObject(
              {
                a: new ASTObject({x: new ASTLiteral(123, position)}, position),
                b: new ASTLiteral(2, position),
                c: new ASTLiteral(3, position),
              },
              position
            ),
            new ASTReference('a', position),
            position
          ),
          new ASTReference('x', position),
          position
        ),
        expected: 123,
      },
      {
        name: 'array index',
        input: new ASTIndex(
          new ASTTuple(
            [
              new ASTLiteral(1, position),
              new ASTLiteral(2, position),
              new ASTLiteral(3, position),
            ],
            position
          ),
          new ASTLiteral(1, position),
          position
        ),
        expected: 2,
      },
      {
        name: 'function call',
        input: new ASTFunction(
          // new ASTLiteral(async (a: number) => a, position),
          new ASTReference('f', position),
          [new ASTLiteral(100, position), new ASTLiteral(10, position)],
          position
        ),
        expected: 110,
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, async () => {
        const observed = await input.eval(context);
        assert.deepEqual(observed, expected);
      });
    }
  });

  describe('Runtime errors', () => {
    const cases: {
      name: string;
      input: ASTNode<unknown>;
      expected: RuntimeErrorCode;
    }[] = [
      {
        name: 'leftside of dot must be object',
        input: new ASTDot(
          new ASTLiteral(1, position),
          new ASTReference('x', position),
          position
        ),
        expected: RuntimeErrorCode.EXPECTED_OBJECT,
      },
      {
        name: 'expected array',
        input: new ASTIndex(
          new ASTLiteral(1, position),
          new ASTLiteral(1, position),
          position
        ),
        expected: RuntimeErrorCode.EXPECTED_ARRAY,
      },
      {
        name: 'expected array index',
        input: new ASTIndex(
          new ASTTuple(
            [
              new ASTLiteral(1, position),
              new ASTLiteral(2, position),
              new ASTLiteral(3, position),
            ],
            position
          ),
          new ASTLiteral('hello', position),
          position
        ),
        expected: RuntimeErrorCode.EXPECTED_ARRAY_INDEX,
      },
      {
        name: 'expected function',
        input: new ASTFunction(
          new ASTReference('a', position),
          [new ASTLiteral(1, position)],
          position
        ),
        expected: RuntimeErrorCode.EXPECTED_FUNCTION,
      },
      {
        name: 'unknown identifier',
        input: new ASTReference('unknown', position),
        expected: RuntimeErrorCode.UNKNOWN_IDENTIFIER,
      },
      {
        name: 'get illegal identifier',
        input: new ASTReference('_a', position),
        expected: RuntimeErrorCode.ILLEGAL_IDENTIFIER,
      },
      {
        name: 'get inaccessible property',
        input: new ASTReference('toString', position),
        expected: RuntimeErrorCode.INACCESSIBLE_PROPERTY,
      },
      {
        name: 'set inaccessible property',
        input: new ASTObject({toString: new ASTLiteral(1, position)}, position),
        expected: RuntimeErrorCode.INACCESSIBLE_PROPERTY,
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, async () => {
        let ok = false;
        try {
          await input.eval(context);
        } catch (e) {
          if (e instanceof RuntimeError) {
            ok = true;
            assert.equal(e.code, expected);
          } else {
            throw e;
          }
        } finally {
          assert.isTrue(ok);
        }
      });
    }
  });

  // describe('String interpolation', () => {
  //   const context = {
  //     x: 456,
  //     y: {z: 789},
  //     f: (a: number, b: number) => a + b,
  //   };

  //   const cases: {
  //     name: string;
  //     input: (StringNode | ExpressionNode)[];
  //     expected: string;
  //   }[] = [
  //     {
  //       name: 'empty',
  //       input: [],
  //       expected: '',
  //     },
  //     {
  //       name: 'one string',
  //       input: [{type: NodeType.STRING, value: 'hello'}],
  //       expected: 'hello',
  //     },
  //     {
  //       name: 'multiple strings',
  //       input: [
  //         {type: NodeType.STRING, value: 'hello'},
  //         {type: NodeType.STRING, value: ', '},
  //         {type: NodeType.STRING, value: 'world!'},
  //       ],
  //       expected: 'hello, world!',
  //     },
  //     {
  //       name: 'expressions',
  //       input: [
  //         {type: NodeType.STRING, value: 'number: '},
  //         {type: NodeType.NUMBER, value: 123},
  //         {type: NodeType.STRING, value: ', dot: '},
  //         {
  //           type: NodeType.DOT,
  //           parent: {type: NodeType.IDENTIFIER, name: 'y'},
  //           child: {type: NodeType.IDENTIFIER, name: 'z'},
  //         },
  //         {type: NodeType.STRING, value: ', function: '},
  //         {
  //           type: NodeType.FUNCTION,
  //           func: {type: NodeType.IDENTIFIER, name: 'f'},
  //           params: [
  //             {type: NodeType.NUMBER, value: 1},
  //             {type: NodeType.NUMBER, value: 10},
  //           ],
  //         },
  //         {type: NodeType.STRING, value: ', end'},
  //       ],
  //       expected: 'number: 123, dot: 789, function: 11, end',
  //     },
  //   ];

  //   for (const {name, input, expected} of cases) {
  //     it(name, () => {
  //       const observed = evaluate(context, {
  //         type: NodeType.CONCATENATION,
  //         children: input,
  //       });
  //       assert.deepEqual(observed, expected);
  //     });
  //   }
  // });
});
