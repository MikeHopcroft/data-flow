import {assert} from 'chai';
import 'mocha';

import {TokenKind, createLexer} from '../../src/lib2';

describe('Lexer', () => {
  describe('Valid tokenizations', () => {
    const cases: {
      name: string;
      input: string;
      expected: {kind: TokenKind; text: string}[];
    }[] = [
      {
        name: 'primitives',
        input: '  +1.23 -456 789 true false id',
        expected: [
          {kind: TokenKind.Number, text: '+1.23'},
          {kind: TokenKind.Number, text: '-456'},
          {kind: TokenKind.Number, text: '789'},
          {kind: TokenKind.Boolean, text: 'true'},
          {kind: TokenKind.Boolean, text: 'false'},
          {kind: TokenKind.Identifier, text: 'id'},
        ],
      },
      {
        name: 'double quote string literal',
        input: '  " hi there \\" \\n 1 true [](),=\' "  ',
        expected: [
          {
            kind: TokenKind.String,
            text: '" hi there \\" \\n 1 true [](),=\' "',
          },
        ],
      },
      {
        name: 'single quote string literal',
        input: "  ' hi there \\' \\n 1 true [](),=\" '  ",
        expected: [
          {
            kind: TokenKind.String,
            text: "' hi there \\' \\n 1 true [](),=\" '",
          },
        ],
      },
      {
        name: 'delimiters',
        input: '[](),=.:{}',
        expected: [
          {kind: TokenKind.LBracket, text: '['},
          {kind: TokenKind.RBracket, text: ']'},
          {kind: TokenKind.LParen, text: '('},
          {kind: TokenKind.RParen, text: ')'},
          {kind: TokenKind.Comma, text: ','},
          {kind: TokenKind.Equals, text: '='},
          {kind: TokenKind.Dot, text: '.'},
          {kind: TokenKind.Colon, text: ':'},
          {kind: TokenKind.LBrace, text: '{'},
          {kind: TokenKind.RBrace, text: '}'},
        ],
      },
      {
        name: 'comment - //',
        input: '1 // comment 5\nfalse',
        expected: [
          {kind: TokenKind.Number, text: '1'},
          {kind: TokenKind.Boolean, text: 'false'},
        ],
      },
      // TODO: comment /* */
    ];

    const lexer = createLexer();

    for (const {name, input, expected} of cases) {
      it(name, () => {
        const tokens = lexer.parse(input);
        const observed: {kind: TokenKind; text: string}[] = [];
        let current = tokens;
        while (current !== undefined) {
          const {kind, text} = current;
          observed.push({kind, text});
          current = current.next;
        }
        assert.deepEqual(observed, expected);
      });
    }
  });

  describe('Lexical Errors', () => {
    const cases: {
      name: string;
      input: string;
      expected: string;
    }[] = [
      {
        name: 'bad number',
        input: '-a',
        expected: '-a',
      },
      {
        name: 'bad identifier',
        input: 'a$b',
        expected: '$b',
      },
      {
        name: 'bad double quote string',
        input: '"hello',
        expected: '"hello',
      },
      {
        name: 'bad single quote string',
        input: "'hello",
        expected: "'hello",
      },
    ];

    const lexer = createLexer();

    for (const {name, input, expected} of cases) {
      it(name, () => {
        let ok = false;
        try {
          const tokens = lexer.parse(input);
          const observed: {kind: TokenKind; text: string}[] = [];
          let current = tokens;
          while (current !== undefined) {
            const {kind, text} = current;
            observed.push({kind, text});
            current = current.next;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          ok = true;
          if ('errorMessage' in e) {
            assert.equal(
              e.errorMessage,
              `Unable to tokenize the rest of the input: ${expected}`
            );
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
