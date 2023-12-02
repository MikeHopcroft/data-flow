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
  EXPECTED_CLOSING_PAREN,
  EXPECTED_COMMA_OR_CLOSING_PAREN,
  EXPECTED_DOT_OR_FUNCTION,
  EXPECTED_EXPRESSION,
  EXPECTED_IDENTIFIER,
  UNEXPECTED_CHARS_AFTER_EXPRESSION,
}

const parseErrorStrings = [
  'Expected comma (,)',
  'Expected closing paren.',
  'Expected comma or closing paren',
  'Expected dot (.) or function.',
  'Expected expression.',
  'Expected identifier.',
  'Unexpected characters after expression',
];

export class ParseError extends Error {
  code: ParseErrorCode;

  constructor(code: ParseErrorCode, message?: string) {
    super(message || parseErrorStrings[code]);
    this.code = code;
  }
}

export class Parser {
  cursor: PeekableSequence<Token>;

  constructor(tokens: Token[]) {
    this.cursor = new PeekableSequence(tokens.values());
  }

  parse(): ExpressionNode {
    const result = this.parse1();
    if (!this.cursor.atEOS()) {
      throw new ParseError(ParseErrorCode.UNEXPECTED_CHARS_AFTER_EXPRESSION);
    }
    return result;
  }

  parse1(): ExpressionNode {
    if (this.cursor.atEOS()) {
      throw new ParseError(ParseErrorCode.EXPECTED_EXPRESSION);
    }

    const t = this.peek();
    if (t.type === TokenType.NUMBER) {
      this.get();
      return {type: NodeType.NUMBER, value: t.value};
    } else if (t.type === TokenType.WORD) {
      this.get();
      const parent = {type: NodeType.IDENTIFIER, name: t.text} as const;
      return this.parse2(parent);
    } else {
      throw new ParseError(ParseErrorCode.EXPECTED_EXPRESSION);
    }
  }

  parse2(current: ExpressionNode): ExpressionNode {
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
        throw new ParseError(ParseErrorCode.UNEXPECTED_CHARS_AFTER_EXPRESSION);
      }
    }
    return current;
  }

  parseDot(parent: ExpressionNode): DotNode {
    // Take the dot.
    this.get();
    if (this.cursor.atEOS()) {
      throw new ParseError(ParseErrorCode.EXPECTED_IDENTIFIER);
    }
    const t = this.get();
    if (t.type !== TokenType.WORD) {
      throw new ParseError(ParseErrorCode.EXPECTED_IDENTIFIER);
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
        params.push(this.parse1());

        while (!this.cursor.atEOS()) {
          if (this.nextIs(')')) {
            break;
          }
          if (!this.nextIs(',')) {
            throw new ParseError(ParseErrorCode.EXPECTED_COMMA);
          }
          // Take the comma.
          this.get();

          // Parse the next parameter.
          params.push(this.parse1());
        }
      }
    }
    if (!this.nextIs(')')) {
      throw new ParseError(ParseErrorCode.EXPECTED_CLOSING_PAREN);
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

  nextIs(char: string): boolean {
    if (this.cursor.atEOS()) {
      return false;
    }
    const t = this.peek();
    return t.type === TokenType.DELIMETER && t.text === char;
  }
}
