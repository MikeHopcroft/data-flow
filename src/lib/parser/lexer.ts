import {buildLexer} from 'typescript-parsec';

import {identifierReForLexer} from './context';

export enum TokenKind {
  Number,
  String,
  Boolean,
  Undefined,
  Null,
  Use,
  Return,
  Identifier,
  LBrace,
  RBrace,
  LBracket,
  RBracket,
  LParen,
  RParen,
  Comma,
  Colon,
  Semicolon,
  Dot,
  Equals,
  Space,
  Comment,
  TemplateComplete,
  TemplateLeft,
  TemplateMiddle,
  TemplateRight,
}

export function createLexer() {
  const lexer = buildLexer([
    [true, /^[-+]?\d*\.?\d*(\d+[eE][-+]?)?\d+/g, TokenKind.Number],
    // TODO: other string literal character escapes
    [true, /^"([^"\\]|\\[\s\S])*"/g, TokenKind.String],
    [true, /^'([^'\\]|\\[\s\S])*'/g, TokenKind.String],
    [true, /^(true|false)/g, TokenKind.Boolean],
    [true, /^undefined/g, TokenKind.Undefined],
    [true, /^null/g, TokenKind.Null],
    [true, /^use/g, TokenKind.Use],
    [true, /^return/g, TokenKind.Return],
    [true, identifierReForLexer, TokenKind.Identifier],
    [true, /^{/g, TokenKind.LBrace],
    [true, /^}/g, TokenKind.RBrace],
    [true, /^\[/g, TokenKind.LBracket],
    [true, /^\]/g, TokenKind.RBracket],
    [true, /^\(/g, TokenKind.LParen],
    [true, /^\)/g, TokenKind.RParen],
    [true, /^,/g, TokenKind.Comma],
    [true, /^:/g, TokenKind.Colon],
    [true, /^;/g, TokenKind.Semicolon],
    [true, /^\./g, TokenKind.Dot],
    [true, /^=/g, TokenKind.Equals],
    [false, /^\/\/[^\n]*/g, TokenKind.Comment],
    [false, /^\/\*(?:[^*]|(?:(?!\*\/)\*))*\*\//g, TokenKind.Comment],
    [false, /^\s+/g, TokenKind.Space],
    // TODO: escaped backticks in template literals
    [true, /^`(?:[^$`]|(?:(?!\${)\$))*`/g, TokenKind.TemplateComplete],
    [true, /^`(?:[^$`]|(?:(?!\${)\$))*\${/g, TokenKind.TemplateLeft],
    [true, /^}(?:[^$`]|(?:(?!\${)\$))*\${/g, TokenKind.TemplateMiddle],
    [true, /^}(?:[^$`]|(?:(?!\${)\$))*`/g, TokenKind.TemplateRight],
  ]);
  return lexer;
}