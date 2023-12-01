import {assert} from 'chai';
import 'mocha';

import {
  EvaluationError,
  EvaluationErrorCode,
  ExpressionNode,
  NodeType,
  StringNode,
  Value,
  evaluate,
  evaluateExpression,
} from '../../src/lib';

describe('Node', () => {
  describe('Basic expressions', () => {
    const context = {
      x: 456,
      y: {z: 789},
      f: (a: number, b: number) => a + b,
    };

    const cases: {name: string; input: ExpressionNode; expected: Value}[] = [
      {
        name: 'number literal',
        input: {type: NodeType.NUMBER, value: 123},
        expected: 123,
      },
      {
        name: 'string literal',
        input: {type: NodeType.STRING, value: 'hello'},
        expected: 'hello',
      },
      {
        name: 'identifier',
        input: {type: NodeType.IDENTIFIER, name: 'x'},
        expected: context.x,
      },
      {
        name: 'dot',
        input: {
          type: NodeType.DOT,
          parent: {type: NodeType.IDENTIFIER, name: 'y'},
          child: {type: NodeType.IDENTIFIER, name: 'z'},
        },
        expected: context.y.z,
      },
      {
        name: 'function',
        input: {
          type: NodeType.FUNCTION,
          func: {type: NodeType.IDENTIFIER, name: 'f'},
          params: [
            {type: NodeType.NUMBER, value: 1},
            {type: NodeType.NUMBER, value: 10},
          ],
        },
        expected: 11,
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, () => {
        const observed = evaluateExpression(context, input);
        assert.deepEqual(observed, expected);
      });
    }
  });

  describe('Runtime errors', () => {
    const context = {
      x: 456,
      y: {z: 789},
      f: (a: number, b: number) => a + b,
    };

    const cases: {
      name: string;
      input: ExpressionNode;
      expected: EvaluationErrorCode;
    }[] = [
      {
        name: 'leftside of dot must be object',
        input: {
          type: NodeType.DOT,
          parent: {type: NodeType.IDENTIFIER, name: 'x'},
          child: {type: NodeType.IDENTIFIER, name: 'z'},
        },
        expected: EvaluationErrorCode.LEFT_SIDE_DOT_NOT_OBJECT,
      },
      {
        name: 'expected function',
        input: {
          type: NodeType.FUNCTION,
          func: {type: NodeType.IDENTIFIER, name: 'x'},
          params: [
            {type: NodeType.NUMBER, value: 1},
            {type: NodeType.NUMBER, value: 10},
          ],
        },
        expected: EvaluationErrorCode.EXPECTED_FUNCTION,
      },
      {
        name: 'unknown identifier',
        input: {type: NodeType.IDENTIFIER, name: 'abc'},
        expected: EvaluationErrorCode.UNKNOWN_IDENTIFIER,
      },
      {
        name: 'illegal identifier',
        input: {type: NodeType.IDENTIFIER, name: '__proto__'},
        expected: EvaluationErrorCode.UNSAFE_PROPERTY,
      },
      {
        name: 'inaccessible property',
        input: {type: NodeType.IDENTIFIER, name: 'toString'},
        expected: EvaluationErrorCode.UNSAFE_PROPERTY,
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, () => {
        let ok = false;
        try {
          evaluateExpression(context, input);
        } catch (e) {
          if (e instanceof EvaluationError) {
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

  describe('String interpolation', () => {
    const context = {
      x: 456,
      y: {z: 789},
      f: (a: number, b: number) => a + b,
    };

    const cases: {
      name: string;
      input: (StringNode | ExpressionNode)[];
      expected: string;
    }[] = [
      {
        name: 'empty',
        input: [],
        expected: '',
      },
      {
        name: 'one string',
        input: [{type: NodeType.STRING, value: 'hello'}],
        expected: 'hello',
      },
      {
        name: 'multiple strings',
        input: [
          {type: NodeType.STRING, value: 'hello'},
          {type: NodeType.STRING, value: ', '},
          {type: NodeType.STRING, value: 'world!'},
        ],
        expected: 'hello, world!',
      },
      {
        name: 'expressions',
        input: [
          {type: NodeType.STRING, value: 'number: '},
          {type: NodeType.NUMBER, value: 123},
          {type: NodeType.STRING, value: ', dot: '},
          {
            type: NodeType.DOT,
            parent: {type: NodeType.IDENTIFIER, name: 'y'},
            child: {type: NodeType.IDENTIFIER, name: 'z'},
          },
          {type: NodeType.STRING, value: ', function: '},
          {
            type: NodeType.FUNCTION,
            func: {type: NodeType.IDENTIFIER, name: 'f'},
            params: [
              {type: NodeType.NUMBER, value: 1},
              {type: NodeType.NUMBER, value: 10},
            ],
          },
          {type: NodeType.STRING, value: ', end'},
        ],
        expected: 'number: 123, dot: 789, function: 11, end',
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, () => {
        const observed = evaluate(context, {
          type: NodeType.CONCATENATION,
          children: input,
        });
        assert.deepEqual(observed, expected);
      });
    }
  });
});
