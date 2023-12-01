import {PeekableSequence} from './peekable-sequence';

export type Tokenization = string | Token[];

export enum TokenType {
  DELIMETER,
  NUMBER,
  WORD,
}
const tokenNames = ['DELIMETER', 'NUMBER', 'WORD'];
export type DelimeterToken = {type: TokenType.DELIMETER; text: string};
export type NumberToken = {type: TokenType.NUMBER; value: number};
export type WordToken = {type: TokenType.WORD; text: string};
export type Token = DelimeterToken | NumberToken | WordToken;

const delimeters = '${}(),. \t\n';
const whitespace = ' \n\t';

export function tokenize(text: string): Tokenization[] {
  const lexer = new Lexer(text);
  return lexer.parse();
}

export enum LexerErrorCode {
  EXPECTED_CLOSING_BRACE,
  INCOMPLETE_ESCAPE_SEQUENCE,
  UNKNOWN_ESCAPE_SEQUENCE,
}

export class LexerError extends Error {
  code: LexerErrorCode;

  constructor(code: LexerErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export class Lexer {
  cursor: PeekableSequence<string>;

  line = 0;
  position = 0;

  constructor(text: string) {
    this.cursor = new PeekableSequence(text.split('').values());
  }

  parse(): Tokenization[] {
    const parts: Tokenization[] = [];
    let current = '';
    while (!this.atEOS()) {
      const c = this.get();
      if (c === '$') {
        if (!this.atEOS() && this.peek() === '{') {
          // Process expression
          if (current) {
            parts.push(current);
          }
          parts.push(this.parseExpression());
          current = '';
        } else {
          // $ not followed by {. Just add it to the string and continue.
          current += this.handleEscape(c);
        }
      } else {
        current += this.handleEscape(c);
      }
    }
    if (current) {
      parts.push(current);
    }
    return parts;
  }

  parseExpression() {
    const tokens: Token[] = [];

    // Take the opening '{'.
    this.get();

    while (!this.atEOS()) {
      this.skipWhite();
      if (!this.atEOS()) {
        const c = this.peek();
        if (c === '}') {
          // Take the closing '}'.
          this.get();
          return tokens;
        } else if (isDelimeter(this.peek())) {
          tokens.push({
            type: TokenType.DELIMETER,
            text: this.get(),
          });
        } else if (/[0-9+-]/.test(c)) {
          const value = this.getNumber();
          tokens.push({type: TokenType.NUMBER, value});
        } else {
          const word = this.getWord();
          tokens.push({type: TokenType.WORD, text: word});
        }
      }
    }
    throw new LexerError(
      LexerErrorCode.EXPECTED_CLOSING_BRACE,
      'Expected closing brace (}).'
    );
  }

  private skipWhite() {
    while (!this.atEOS()) {
      const c = this.peek();
      if (whitespace.includes(c)) {
        this.get();
      } else {
        break;
      }
    }
  }

  private getNumber() {
    let word = this.get();
    while (!this.atEOS()) {
      const c = this.peek();
      if (/[0-9]/.test(c)) {
        word += this.get();
      } else {
        break;
      }
    }
    return Number(word);
  }

  private getWord() {
    let word = this.get();
    while (!this.atEOS()) {
      const c = this.peek();
      if (isDelimeter(c)) {
        break;
      }
      word += this.get();
    }
    return word;
  }

  private handleEscape(c: string) {
    if (c === '\\') {
      if (this.atEOS()) {
        throw new LexerError(
          LexerErrorCode.INCOMPLETE_ESCAPE_SEQUENCE,
          'Incomplete escape sequence.'
        );
      }

      // Get the escaped character.
      const c2 = this.get();
      if (c2 !== '$') {
        throw new LexerError(
          LexerErrorCode.UNKNOWN_ESCAPE_SEQUENCE,
          `Unknown escape sequence \\${c2}.`
        );
      }
      return c2;
    } else {
      return c;
    }
  }

  private atEOS() {
    return this.cursor.atEOS();
  }

  private get() {
    const c = this.cursor.get();
    if (c === '\n') {
      this.line++;
      this.position = 0;
    } else {
      this.position++;
    }
    return c;
  }

  private peek() {
    return this.cursor.peek();
  }
}

export function isDelimeter(c: string) {
  return delimeters.includes(c);
}

export function formatTokens(tokens: Token[]) {
  return tokens.map(
    t =>
      `${tokenNames[t.type]}: "${
        t.type === TokenType.NUMBER ? t.value : t.text
      }"`
  );
}
