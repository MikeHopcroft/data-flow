import {assert} from 'chai';
import 'mocha';

import {TokenKind, createLexer} from '../../src/lib2';

describe('lexer', () => {
  describe('general', () => {
    const cases: {
      name: string;
      input: string;
      expected: {kind: TokenKind; text: string}[];
    }[] = [
      {
        name: 'primitives',
        input: '  1 true false id',
        expected: [
          {kind: TokenKind.Number, text: '1'},
          {kind: TokenKind.Boolean, text: 'true'},
          {kind: TokenKind.Boolean, text: 'false'},
          {kind: TokenKind.Identifier, text: 'id'},
        ],
      },
      {
        name: 'double quote string literal',
        input: '  " hi there 1 true [](),=\' "  ',
        expected: [
          {kind: TokenKind.String, text: '" hi there 1 true [](),=\' "'},
        ],
      },
      {
        name: 'single quote string literal',
        input: "  ' hi there 1 true [](),=\" '  ",
        expected: [
          {kind: TokenKind.String, text: "' hi there 1 true [](),=\" '"},
        ],
      },
      {
        name: 'delimers',
        input: '[](),=',
        expected: [
          {kind: TokenKind.LBracket, text: '['},
          {kind: TokenKind.RBracket, text: ']'},
          {kind: TokenKind.LParen, text: '('},
          {kind: TokenKind.RParen, text: ')'},
          {kind: TokenKind.Comma, text: ','},
          {kind: TokenKind.Equals, text: '='},
        ],
      },
    ];

    const lexer = createLexer();

    for (const c of cases) {
      it(c.name, () => {
        const tokens = lexer.parse(c.input);
        const observed: {kind: TokenKind; text: string}[] = [];
        let current = tokens;
        while (current !== undefined) {
          const {kind, text} = current;
          observed.push({kind, text});
          current = current.next;
        }
        assert.deepEqual(observed, c.expected);
      });
    }
  });
});
