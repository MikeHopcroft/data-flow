import {buildLexer} from 'typescript-parsec';

export enum TokenKind {
  Number,
  String,
  Boolean,
  Use,
  Return,
  Identifier,
  LBracket,
  RBracket,
  LParen,
  RParen,
  Comma,
  Equals,
  Space,
  Comment,
}

export function createLexer() {
  const lexer = buildLexer([
    // TODO: handle, e.g. E+09
    [true, /^-?\d+(\.\d+)?/g, TokenKind.Number],
    // TODO: single quotes, escaped quotes, other escapes
    [true, /^"([^"\\]|\\[\s\S])*"/g, TokenKind.String],
    [true, /^'([^'\\]|\\[\s\S])*'/g, TokenKind.String],
    [true, /^(true|false)/g, TokenKind.Boolean],
    // TODO: undefined and null
    [true, /^use/g, TokenKind.Use],
    [true, /^return/g, TokenKind.Return],
    // TODO: reused RE for safe property accessor
    [true, /^[a-zA-Z_]+[a-zA-Z_0-9]*/g, TokenKind.Identifier],
    [true, /^\[/g, TokenKind.LBracket],
    [true, /^\]/g, TokenKind.RBracket],
    [true, /^\(/g, TokenKind.LParen],
    [true, /^\)/g, TokenKind.RParen],
    [true, /^,/g, TokenKind.Comma],
    [true, /^=/g, TokenKind.Equals],
    // TODO: /* */ comments, when not inside strings
    [false, /^\/\/[^\n]*/g, TokenKind.Comment],
    [false, /^\s+/g, TokenKind.Space],
    // TODO: string interpolation
  ]);
  return lexer;
}
