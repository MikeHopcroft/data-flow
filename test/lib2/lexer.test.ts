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
        name: 'numbers',
        input: '1 +2 -3 .345 4.56e-9 .567e+51',
        expected: [
          {kind: TokenKind.Number, text: '1'},
          {kind: TokenKind.Number, text: '+2'},
          {kind: TokenKind.Number, text: '-3'},
          {kind: TokenKind.Number, text: '.345'},
          {kind: TokenKind.Number, text: '4.56e-9'},
          {kind: TokenKind.Number, text: '.567e+51'},
        ],
      },
      {
        name: 'booleans',
        input: '  true false ',
        expected: [
          {kind: TokenKind.Boolean, text: 'true'},
          {kind: TokenKind.Boolean, text: 'false'},
        ],
      },
      {
        name: 'identifer',
        input: '   id  ',
        expected: [{kind: TokenKind.Identifier, text: 'id'}],
      },
      {
        name: 'undefined',
        input: '   undefined  ',
        expected: [{kind: TokenKind.Undefined, text: 'undefined'}],
      },
      {
        name: 'null',
        input: '   null  ',
        expected: [{kind: TokenKind.Null, text: 'null'}],
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
      {
        name: 'template literal - degenerate',
        input: ' `hello` ',
        expected: [{kind: TokenKind.TemplateComplete, text: '`hello`'}],
      },
      {
        name: 'template literal - typical',
        input: ' `hello $ { } ${name}, how ${true}!` ',
        expected: [
          {kind: TokenKind.TemplateLeft, text: '`hello $ { } ${'},
          {kind: TokenKind.Identifier, text: 'name'},
          {kind: TokenKind.TemplateMiddle, text: '}, how ${'},
          {kind: TokenKind.Boolean, text: 'true'},
          {kind: TokenKind.TemplateRight, text: '}!`'},
        ],
      },
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
