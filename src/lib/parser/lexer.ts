// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable:max-classes-per-file
// tslint:disable:no-constant-condition
// tslint:disable:no-null-keyword

import {Parser, ParserOutput, unableToConsumeToken} from 'typescript-parsec';
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

export const tokenNames = [
  'Number',
  'String',
  'Boolean',
  'Undefined',
  'Null',
  'Use',
  'Return',
  'Identifier',
  'LBrace',
  'RBrace',
  'LBracket',
  'RBracket',
  'LParen',
  'RParen',
  'Comma',
  'Colon',
  'Semicolon',
  'Dot',
  'Equals',
  'Space',
  'Comment',
  'TemplateComplete',
  'TemplateLeft',
  'TemplateMiddle',
  'TemplateRight',
];

export function createLexer2() {
  const lexer = buildLexer([
    [
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
      // [true, /^}(?:[^$`]|(?:(?!\${)\$))*\${/g, TokenKind.TemplateMiddle],
      // [true, /^}(?:[^$`]|(?:(?!\${)\$))*`/g, TokenKind.TemplateRight],
    ],
    [
      [true, /^}(?:[^$`]|(?:(?!\${)\$))*\${/g, TokenKind.TemplateMiddle],
      [true, /^}(?:[^$`]|(?:(?!\${)\$))*`/g, TokenKind.TemplateRight],
    ],
  ]);
  return lexer;
}

export interface TokenPosition {
  readonly index: number;
  readonly rowBegin: number;
  readonly columnBegin: number;
  readonly rowEnd: number;
  readonly columnEnd: number;
}

export interface Token<T> {
  readonly kind: T;
  readonly text: string;
  readonly pos: TokenPosition;
  readonly next: Token<T> | undefined;
}

export interface Lexer<T> {
  parse(input: string): Token<T> | undefined;
}

function posToString(pos: TokenPosition | undefined): string {
  return pos === undefined ? '<END-OF-FILE>' : JSON.stringify(pos);
}

export class TokenError extends Error {
  constructor(
    public pos: TokenPosition | undefined,
    public errorMessage: string
  ) {
    super(`${posToString(pos)}: ${errorMessage}`);
  }
}

export class TokenRangeError extends Error {
  constructor(
    public first: TokenPosition | undefined,
    public next: TokenPosition | undefined,
    public errorMessage: string
  ) {
    super(`${posToString(first)} - ${posToString(next)}: ${errorMessage}`);
  }
}

export function extractByPositionRange(
  input: string,
  first: TokenPosition | undefined,
  next: TokenPosition | undefined
): string {
  const firstIndex = first === undefined ? input.length : first.index;
  const nextIndex = next === undefined ? input.length : next.index;
  if (firstIndex >= nextIndex) {
    return '';
  }
  return input.substring(firstIndex, nextIndex);
}

export function extractByTokenRange<T>(
  input: string,
  first: Token<T> | undefined,
  next: Token<T> | undefined
): string {
  return extractByPositionRange(
    input,
    first === undefined ? undefined : first.pos,
    next === undefined ? undefined : next.pos
  );
}

class TokenImpl2<T> implements Token<T> {
  private nextToken: Token<T> | undefined | null;

  constructor(
    private readonly lexer: LexerImpl2<T>,
    private readonly input: string,
    public kind: T,
    public text: string,
    public pos: TokenPosition,
    public keep: boolean
  ) {}

  public get next(): Token<T> | undefined {
    if (this.nextToken === undefined) {
      this.nextToken = this.lexer.parseNextAvailable(
        this.input,
        this.pos.index + this.text.length,
        this.pos.rowEnd,
        this.pos.columnEnd,
        0
      );
      if (this.nextToken === undefined) {
        this.nextToken = null;
      }
    }

    return this.nextToken === null ? undefined : this.nextToken;
  }

  public retokenize(mode: number): TokenImpl2<T> | undefined {
    try {
      const token = this.lexer.parseNextAvailable(
        this.input,
        this.pos.index,
        this.pos.rowEnd,
        this.pos.columnEnd,
        mode
      );
      return token;
      // eslint-disable-next-line no-empty
    } catch (e) {}
    return undefined;
  }
}

class LexerImpl2<T> implements Lexer<T> {
  constructor(public modes: [boolean, RegExp, T][][]) {
    for (const rules of modes) {
      for (const rule of rules) {
        if (rule[1].source[0] !== '^') {
          throw new Error(
            `Regular expression patterns for a tokenizer should start with "^": ${rule[1].source}`
          );
        }
        if (!rule[1].global) {
          throw new Error(
            `Regular expression patterns for a tokenizer should be global: ${rule[1].source}`
          );
        }
      }
    }
  }

  public parse(input: string): TokenImpl2<T> | undefined {
    return this.parseNextAvailable(input, 0, 1, 1, 0);
  }

  public parseNext(
    input: string,
    indexStart: number,
    rowBegin: number,
    columnBegin: number,
    mode: number
  ): TokenImpl2<T> | undefined {
    if (indexStart === input.length) {
      return undefined;
    }

    const subString = input.substr(indexStart);
    let result: TokenImpl2<T> | undefined;
    for (const [keep, regexp, kind] of this.modes[mode]) {
      regexp.lastIndex = 0;
      if (regexp.test(subString)) {
        const text = subString.substr(0, regexp.lastIndex);
        let rowEnd = rowBegin;
        let columnEnd = columnBegin;
        for (const c of text) {
          switch (c) {
            case '\r':
              break;
            case '\n':
              rowEnd++;
              columnEnd = 1;
              break;
            default:
              columnEnd++;
          }
        }

        const newResult = new TokenImpl2<T>(
          this,
          input,
          kind,
          text,
          {index: indexStart, rowBegin, columnBegin, rowEnd, columnEnd},
          keep
        );
        if (
          result === undefined ||
          result.text.length < newResult.text.length
        ) {
          result = newResult;
        }
      }
    }

    if (result === undefined) {
      throw new TokenError(
        {
          index: indexStart,
          rowBegin,
          columnBegin,
          rowEnd: rowBegin,
          columnEnd: columnBegin,
        },
        `Unable to tokenize the rest of the input: ${input.substr(indexStart)}`
      );
    } else {
      return result;
    }
  }

  public parseNextAvailable(
    input: string,
    index: number,
    rowBegin: number,
    columnBegin: number,
    mode: number
  ): TokenImpl2<T> | undefined {
    let token: TokenImpl2<T> | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      token = this.parseNext(
        input,
        token === undefined ? index : token.pos.index + token.text.length,
        token === undefined ? rowBegin : token.pos.rowEnd,
        token === undefined ? columnBegin : token.pos.columnEnd,
        mode
      );
      if (token === undefined) {
        return undefined;
      } else if (token.keep) {
        return token;
      }
    }
  }
}

export function buildLexer<T>(modes: [boolean, RegExp, T][][]): Lexer<T> {
  return new LexerImpl2<T>(modes);
}

export function templateTok<T>(toMatch: T): Parser<T, Token<T>> {
  return {
    parse(token: Token<T> | undefined): ParserOutput<T, Token<T>> {
      if (token && token instanceof TokenImpl2) {
        const templateToken = token.retokenize(1);
        if (templateToken && templateToken.kind === toMatch) {
          return {
            candidates: [
              {
                firstToken: templateToken,
                nextToken: templateToken.next,
                result: templateToken,
              },
            ],
            successful: true,
            error: undefined,
          };
        }
      }

      return {
        successful: false,
        error: unableToConsumeToken(token),
      };
    },
  };
}
