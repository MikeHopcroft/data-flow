import {Token, TokenType, tokenize} from './lexer';
import {
  ConcatenationNode,
  DotNode,
  ExpressionNode,
  FunctionNode,
  NodeType,
} from './node';
import {PeekableSequence} from './peekable-sequence';

export function parse(src: string): ConcatenationNode {
  const tokenization = tokenize(src);
  const children: ExpressionNode[] = tokenization.map(t => {
    if (typeof t === 'string') {
      return {type: NodeType.STRING, value: t};
    } else {
      const parser = new Parser(t);
      return parser.parse();
    }
  });
  return {type: NodeType.CONCATENATION, children};
}

export enum ParseErrorCode {
  EXPECTED_COMMA,
  EXPECTED_DOT_OR_FUNCTION,
  EXPECTED_CLOSING_PAREN,
  EXPECTED_COMMA_OR_CLOSING_PAREN,
  UNEXPECTED_CHARS_AFTER_EXPRESSION,
}

export class ParseError extends Error {
  code: ParseErrorCode;

  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export class Parser {
  cursor: PeekableSequence<Token>;

  constructor(tokens: Token[]) {
    this.cursor = new PeekableSequence(tokens.values());
  }

  parse(): ExpressionNode {
    const t = this.peek();
    if (t.type === TokenType.NUMBER) {
      this.get();
      return {type: NodeType.NUMBER, value: t.value};
    } else if (t.type === TokenType.WORD) {
      this.get();
      const parent = {type: NodeType.IDENTIFIER, name: t.text} as const;
      return this.parse2(parent);
      // if (this.cursor.atEOS()) {
      //   return parent;
      // }
      // const next = this.peek();
      // if (next.type === TokenType.DELIMETER) {
      //   if (next.text === '(') {
      //     return this.parseFunction(parent);
      //   } else if (next.text === '.') {
      //     return this.parseDot(parent);
      //   }
      // }
      // throw new ParseError(
      //   ParseErrorCode.EXPECTED_DOT_OR_FUNCTION,
      //   'Expected dot (.) or open parentheses (().'
      // );
    }
    throw new ParseError(
      ParseErrorCode.UNEXPECTED_CHARS_AFTER_EXPRESSION,
      'Unexpected characters after expression'
    );
  }

  parse2(current: ExpressionNode): ExpressionNode {
    // const t = this.get();
    // let current = {type: NodeType.IDENTIFIER, name: t.text} as const;
    while (!this.cursor.atEOS()) {
      const next = this.peek();
      if (next.type === TokenType.DELIMETER) {
        if (next.text === '(') {
          current = this.parseFunction(current);
        } else if (next.text === '.') {
          current = this.parseDot(current);
        } else {
          // This is either `,` or `)`, so end parsing at this level.
          break;
        }
      } else {
        throw 1;
      }
    }
    return current;
  }

  parseDot(parent: ExpressionNode): DotNode {
    // Take the dot.
    this.get();
    if (this.cursor.atEOS()) {
      throw 1;
    }
    const t = this.get();
    if (t.type !== TokenType.WORD) {
      throw 2;
    }
    const child = {type: NodeType.IDENTIFIER, name: t.text} as const;
    return {type: NodeType.DOT, parent, child};
  }

  parseFunction(func: ExpressionNode): FunctionNode {
    const params: ExpressionNode[] = [];

    // Take the opening paren.
    this.get();

    if (!this.cursor.atEOS()) {
      const t1 = this.peek();
      if (t1.type !== TokenType.DELIMETER || t1.text !== ')') {
        params.push(this.parse());

        while (!this.cursor.atEOS()) {
          if (this.nextIs(')')) {
            break;
          }
          if (!this.nextIs(',')) {
            throw new ParseError(
              ParseErrorCode.EXPECTED_COMMA,
              'Expected comma (,).'
            );
          }
          // Take the comma.
          this.get();

          // Parse the next parameter.
          params.push(this.parse());
        }
      }
    }
    if (!this.nextIs(')')) {
      throw new ParseError(
        ParseErrorCode.EXPECTED_CLOSING_PAREN,
        'Expected closing paren ")".'
      );
    }
    // Take the closing paren.
    this.get();
    return {type: NodeType.FUNCTION, func, params};
  }

  get(): Token {
    return this.cursor.get();
  }

  peek(): Token {
    return this.cursor.peek();
  }

  // skipDelimiter(char: string): boolean {
  //   if (!this.cursor.atEOS()) {
  //     const t = this.cursor.peek();
  //     if (t.type === TokenType.DELIMETER && t.text === char) {
  //       this.get();
  //       return true;
  //     }
  //   }
  //   return false;
  // }

  nextIs(char: string): boolean {
    if (this.cursor.atEOS()) {
      return false;
    }
    const t = this.peek();
    return t.type === TokenType.DELIMETER && t.text === char;
  }
}

function delimiter(text: string): Token {
  return {type: TokenType.DELIMETER, text};
}
