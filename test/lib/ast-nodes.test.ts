import {assert} from 'chai';
import dedent from 'dedent';
import 'mocha';
import {TokenPosition} from 'typescript-parsec';
import z from 'zod';

import {
  ASTDot,
  ASTFunction,
  ASTIndex,
  ASTLiteral,
  ASTNode,
  ASTObject,
  ASTReference,
  ASTTemplate,
  ASTTuple,
  Context,
  ErrorCode,
  ErrorEx,
  Value,
  resolve,
} from '../../src/lib';

const contextValues = {
  x: 456,
  y: {z: 789},
  a: ['one', 'two', 'three'],
  f: (a: number, b: number) => a + b,
  unapproved: (a: number, b: number) => a + b,
};
const context = Context.create(
  contextValues,
  [[contextValues.f, z.array(z.number(), z.number())]],
  {}
);

const position: TokenPosition = {
  index: 0,
  rowBegin: 0,
  columnBegin: 0,
  rowEnd: 0,
  columnEnd: 0,
};

class MockASTNode implements ASTNode<number> {
  position: TokenPosition;
  evalCount = 0;

  constructor(position: TokenPosition) {
    this.position = position;
  }

  eval(): Promise<number> {
    return Promise.resolve(++this.evalCount);
  }

  serialize(): string {
    return String(this.evalCount);
  }

  resolve(): ASTNode<number> {
    return this;
  }
}

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
        name: 'template literal',
        input: new ASTTemplate(
          [
            new ASTLiteral('before ', position),
            new ASTLiteral(2, position),
            new ASTLiteral(' after', position),
          ],
          position
        ),
        expected: 'before 2 after',
      },
      {
        name: 'identifier',
        input: new ASTReference('x', position),
        expected: contextValues.x,
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
      expected: ErrorCode;
    }[] = [
      {
        name: 'leftside of dot must be object',
        input: new ASTDot(
          new ASTLiteral(1, position),
          new ASTReference('x', position),
          position
        ),
        expected: ErrorCode.EXPECTED_OBJECT,
      },
      {
        name: 'expected array',
        input: new ASTIndex(
          new ASTLiteral(1, position),
          new ASTLiteral(1, position),
          position
        ),
        expected: ErrorCode.EXPECTED_ARRAY,
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
        expected: ErrorCode.EXPECTED_ARRAY_INDEX,
      },
      {
        name: 'expected function',
        input: new ASTFunction(
          new ASTReference('a', position),
          [new ASTLiteral(1, position)],
          position
        ),
        expected: ErrorCode.EXPECTED_FUNCTION,
      },
      {
        name: 'unknown identifier',
        input: new ASTReference('unknown', position),
        expected: ErrorCode.UNKNOWN_IDENTIFIER,
      },
      {
        name: 'get illegal identifier',
        input: new ASTReference('_a', position),
        expected: ErrorCode.ILLEGAL_IDENTIFIER,
      },
      {
        name: 'get inaccessible property',
        input: new ASTReference('toString', position),
        expected: ErrorCode.INACCESSIBLE_PROPERTY,
      },
      {
        name: 'set inaccessible property',
        input: new ASTObject({toString: new ASTLiteral(1, position)}, position),
        expected: ErrorCode.INACCESSIBLE_PROPERTY,
      },
      {
        name: 'unapproved function',
        input: new ASTFunction(
          new ASTReference('unapproved', position),
          [new ASTLiteral(1, position), new ASTLiteral(2, position)],
          position
        ),
        expected: ErrorCode.UNAPPROVED_FUNCTION,
      },
      {
        name: 'invalid function parameters',
        input: new ASTFunction(
          new ASTReference('f', position),
          [new ASTLiteral(true, position), new ASTLiteral('hi', position)],
          position
        ),
        expected: ErrorCode.INVALID_PARAMS,
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, async () => {
        let ok = false;
        try {
          await input.eval(context);
        } catch (e) {
          if (e instanceof ErrorEx) {
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

  it('Memoization', async () => {
    const context2 = Context.create({}, undefined, {
      f: new MockASTNode(position),
    });

    const root = new ASTTuple(
      [new ASTReference('f', position), new ASTReference('f', position)],
      position
    );

    const observed = await root.eval(context2);
    const expected = [1, 1];
    assert.deepEqual(observed, expected);
  });

  it('Cycle detected', async () => {
    const context2 = Context.create({}, undefined, {
      a: new ASTReference('b', position),
      b: new ASTReference('c', position),
      c: new ASTReference('a', position),
    });

    const root = new ASTReference('a', position);

    let ok = false;
    try {
      await root.eval(context2);
    } catch (e) {
      if (e instanceof ErrorEx) {
        ok = true;
        assert.equal(e.code, ErrorCode.CYCLE_DETECTED);
      } else {
        throw e;
      }
    } finally {
      assert.isTrue(ok);
    }
  });

  describe('Serialization', () => {
    const cases: {name: string; input: ASTNode<unknown>; expected: string}[] = [
      {
        name: 'number literal',
        input: new ASTLiteral(123, position),
        expected: '123',
      },
      {
        name: 'string literal',
        input: new ASTLiteral('hello', position),
        expected: "'hello'",
      },
      {
        name: 'boolean literal',
        input: new ASTLiteral(true, position),
        expected: 'true',
      },
      {
        name: 'undefined literal',
        input: new ASTLiteral(undefined, position),
        expected: 'undefined',
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
        expected: '{a:1,b:2,c:3}',
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
        expected: '[1,2,3]',
      },
      {
        name: 'template literal',
        input: new ASTTemplate(
          [
            new ASTLiteral('before ', position),
            new ASTReference('a', position),
            new ASTLiteral(' after', position),
          ],
          position
        ),
        expected: '`before ${a} after`',
      },
      {
        name: 'identifier',
        input: new ASTReference('x', position),
        expected: 'x',
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
        expected: '{a:1,b:2,c:3}.b',
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
        expected: '{a:{x:123},b:2,c:3}.a.x',
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
        expected: '[1,2,3][1]',
      },
      {
        name: 'function call',
        input: new ASTFunction(
          new ASTReference('f', position),
          [new ASTLiteral(100, position), new ASTLiteral(10, position)],
          position
        ),
        expected: 'f(100,10)',
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, () => {
        const observed = input.serialize();
        assert.equal(observed, expected);
      });
    }
  });

  describe('Resolve', () => {
    const cases: {name: string; input: string; expected: string}[] = [
      {
        name: 'chaining',
        input: dedent`
          a = 1;
          b = {x: a};
          c = 2;
          return f(b.x, c);
        `,
        expected: 'f({x:1}.x,2)',
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, async () => {
        const observed = resolve(input).serialize();
        assert.equal(observed, expected);
      });
    }
  });
});
