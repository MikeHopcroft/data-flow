import {assert} from 'chai';
import 'mocha';

import {ExpressionNode, NodeType, Parser, Token, tokenize} from '../../src/lib';

describe('Parser', () => {
  describe('Basic expressions', () => {
    const cases: {name: string; src: string; expected: ExpressionNode}[] = [
      {
        name: 'positive number',
        src: '${+4}',
        expected: {
          type: NodeType.NUMBER,
          value: 4,
        },
      },
      {
        name: 'negative number',
        src: '${-53}',
        expected: {
          type: NodeType.NUMBER,
          value: -53,
        },
      },
      {
        name: 'plain number',
        src: '${123}',
        expected: {
          type: NodeType.NUMBER,
          value: 123,
        },
      },
      {
        name: 'identifier',
        src: '${abc}',
        expected: {
          type: NodeType.IDENTIFIER,
          name: 'abc',
        },
      },
      {
        name: 'dot',
        src: '${a.b}',
        expected: {
          type: NodeType.DOT,
          parent: {
            type: NodeType.IDENTIFIER,
            name: 'a',
          },
          child: {
            type: NodeType.IDENTIFIER,
            name: 'b',
          },
        },
      },
      {
        name: 'function - 0 parameters',
        src: '${a()}',
        expected: {
          type: NodeType.FUNCTION,
          func: {
            type: NodeType.IDENTIFIER,
            name: 'a',
          },
          params: [],
        },
      },
      {
        name: 'function - 1 numeric parameter',
        src: '${a(123)}',
        expected: {
          type: NodeType.FUNCTION,
          func: {
            type: NodeType.IDENTIFIER,
            name: 'a',
          },
          params: [
            {
              type: NodeType.NUMBER,
              value: 123,
            },
          ],
        },
      },
      {
        name: 'function - 1 label parameter',
        src: '${a(b)}',
        expected: {
          type: NodeType.FUNCTION,
          func: {
            type: NodeType.IDENTIFIER,
            name: 'a',
          },
          params: [
            {
              type: NodeType.IDENTIFIER,
              name: 'b',
            },
          ],
        },
      },
      // {
      //   name: 'string',
      //   src: 'abc',
      //   expected: {
      //     type: NodeType.STRING,
      //     value: 'abc',
      //   },
      // },
      {
        name: 'complex',
        src: '${a.b(1).c}',
        expected: {
          type: 1,
          parent: {
            type: 2,
            func: {
              type: 1,
              parent: {
                type: 3,
                name: 'a',
              },
              child: {
                type: 3,
                name: 'b',
              },
            },
            params: [
              {
                type: NodeType.NUMBER,
                value: 1,
              },
            ],
          },
          child: {
            type: 3,
            name: 'c',
          },
        },
      },
    ];
    for (const {name, src, expected} of cases) {
      it(name, () => {
        const tokenization = tokenize(src);
        const parser = new Parser(tokenization[0] as Token[]);
        const observed = parser.parse();
        console.log(JSON.stringify(observed, null, 2));
        assert.deepEqual(observed, expected);
      });
    }
  });
});
