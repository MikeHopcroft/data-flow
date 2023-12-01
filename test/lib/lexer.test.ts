import {assert} from 'chai';
import 'mocha';

import {
  LexerError,
  LexerErrorCode,
  Tokenization,
  tokenize,
} from '../../src/lib';

describe('Lexer', () => {
  describe('Basic expressions', () => {
    const cases: {name: string; input: string; expected: Tokenization[]}[] = [
      {
        name: 'empty',
        input: '',
        expected: [],
      },
      {
        name: 'escaping',
        input: 'abc\\${123} def${123}',
        expected: ['abc${123} def', [{type: 1, value: 123}]],
      },
      {
        name: 'lone dollar sign',
        input: 'abc$ def',
        expected: ['abc$ def'],
      },
      {
        name: 'white space',
        input: 'abc  ${  123\t  }\t def${123}  ',
        expected: [
          'abc  ', // Whitespace significant in strings
          [{type: 1, value: 123}],
          '\t def', // Whitespace significant in strings
          [{type: 1, value: 123}],
          '  ', // Whitespace significant in strings
        ],
      },
      {
        name: 'general',
        input: '  a\\${bc def${-1}\nghi\t${a.b.c(p,q)}jkl  ',
        expected: [
          '  a${bc def',
          [{type: 1, value: -1}],
          '\nghi\t',
          [
            {type: 2, text: 'a'},
            {type: 0, text: '.'},
            {type: 2, text: 'b'},
            {type: 0, text: '.'},
            {type: 2, text: 'c'},
            {type: 0, text: '('},
            {type: 2, text: 'p'},
            {type: 0, text: ','},
            {type: 2, text: 'q'},
            {type: 0, text: ')'},
          ],
          'jkl  ',
        ],
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, () => {
        const observed = tokenize(input);
        console.log(JSON.stringify(observed));
        assert.deepEqual(observed, expected);
      });
    }
  });

  describe('Errors', () => {
    const cases: {name: string; input: string; expected: LexerErrorCode}[] = [
      {
        name: 'incomplete escape sequence',
        input: 'abc\\',
        expected: LexerErrorCode.INCOMPLETE_ESCAPE_SEQUENCE,
      },
      {
        name: 'unknown escape sequence',
        input: 'abc\\n def',
        expected: LexerErrorCode.UNKNOWN_ESCAPE_SEQUENCE,
      },
    ];

    for (const {name, input, expected} of cases) {
      it(name, () => {
        let ok = false;
        try {
          tokenize(input);
        } catch (e) {
          if (e instanceof LexerError) {
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
