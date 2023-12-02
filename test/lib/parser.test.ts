import {assert} from 'chai';
import 'mocha';

import {
  ExpressionNode,
  NodeType,
  ParseError,
  ParseErrorCode,
  Parser,
  Token,
  tokenize,
} from '../../src/lib';

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

  describe('Errors', () => {
    const cases: {name: string; src: string; expected: ParseErrorCode}[] = [
      {
        name: 'empty',
        src: '${}',
        expected: ParseErrorCode.EXPECTED_EXPRESSION,
      },
      {
        name: 'comma',
        src: '${,}',
        expected: ParseErrorCode.EXPECTED_EXPRESSION,
      },
      {
        name: 'unexpected chars after number',
        src: '${1a}',
        expected: ParseErrorCode.UNEXPECTED_CHARS_AFTER_EXPRESSION,
      },
      {
        name: 'unexpected chars after dot expression',
        src: '${a.b,}',
        expected: ParseErrorCode.UNEXPECTED_CHARS_AFTER_EXPRESSION,
      },
      {
        name: 'missing parameter',
        src: '${a(1,)}',
        expected: ParseErrorCode.EXPECTED_EXPRESSION,
      },
      {
        name: 'missing paren',
        src: '${a(1,2}',
        expected: ParseErrorCode.EXPECTED_CLOSING_PAREN,
      },
      {
        name: 'indentifier identifier',
        src: '${a b}',
        expected: ParseErrorCode.UNEXPECTED_CHARS_AFTER_EXPRESSION,
      },
      {
        name: 'indentifier.',
        src: '${a.}',
        expected: ParseErrorCode.EXPECTED_IDENTIFIER,
      },
      {
        name: 'indentifier.number',
        src: '${a.5}',
        expected: ParseErrorCode.EXPECTED_IDENTIFIER,
      },
      {
        name: 'function(identifier identifier)',
        src: '${a(b c)}',
        expected: ParseErrorCode.UNEXPECTED_CHARS_AFTER_EXPRESSION,
        // TODO: Could we get this error from parse2 instead?
        // expected: ParseErrorCode.EXPECTED_COMMA_OR_CLOSING_PAREN,
      },
    ];
    for (const {name, src, expected} of cases) {
      it(name, () => {
        let ok = false;
        try {
          const tokenization = tokenize(src);
          const parser = new Parser(tokenization[0] as Token[]);
          const observed = parser.parse();
          console.log(JSON.stringify(observed, null, 2));
        } catch (e) {
          if (e instanceof ParseError) {
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
});
