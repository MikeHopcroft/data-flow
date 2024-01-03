import {
  alt,
  apply,
  expectEOF,
  expectSingleResult,
  kleft,
  kmid,
  kright,
  list_sc,
  opt,
  opt_sc,
  rep_sc,
  rule,
  seq,
  tok,
  Token,
} from 'typescript-parsec';
import unescape from 'unescape-js';

import {ASTNode} from '../interfaces';

import {
  Action,
  ASTDot,
  ASTFunction,
  ASTIndex,
  ASTLiteral,
  ASTObject,
  ASTProgram,
  ASTReference,
  ASTTemplate,
  ASTTuple,
} from './ast-nodes';
import {saferGet} from './context';
import {ErrorCode, ErrorEx} from './errors';
import {createLexer, TokenKind} from './lexer';
import {createLexer2, templateTok} from './lexer2';

// ALIAS_DEC = Identifier Equals EXPR
//
// LIST = EXPR [Comma EXPR]*
//
// TUPLE = LBracket LIST RBracket
//
// BINDING = IDENTIFIER Colon EXRP
// BINDING_LIST = BINDING [Comma BINDING]*
// OBJECT = LBRACE BINDING_LIST? RBRACE
//
// FUNCTION_CALL = Identifier LParen LIST RParen
//
// LITERAL_EXPR =
//   Boolean
//   Number
//   String
//   undefined
//   null
//   TUPLE
//   OBJECT
//
// DOT_EXPR =
//
// ARRAY_INDEX
//
// PROGRAM = VARDEC* (USE | RETURN)
//
// USE = Use EXPR
// RETURN = Return EXPR
//
// EXPR2 =
//   DOT_EXPR
//   ARRAY_INDEX
//   EXPR
//
// EXPR =
//   LITERAL_EXPR
//   FUNCTION_CALL
//   IDENTIFIER

function applyBoolean(value: Token<TokenKind.Boolean>): ASTLiteral<boolean> {
  return new ASTLiteral(value.text === 'true', value.pos);
}

function applyNumber(value: Token<TokenKind.Number>): ASTLiteral<number> {
  return new ASTLiteral(Number(value.text), value.pos);
}

function applyString(value: Token<TokenKind.String>): ASTLiteral<string> {
  return new ASTLiteral(unescape(value.text.slice(1, -1)), value.pos);
}

function applyUndefined(
  value: Token<TokenKind.Undefined>
): ASTLiteral<undefined> {
  return new ASTLiteral(undefined, value.pos);
}

function applyNull(value: Token<TokenKind.Null>): ASTLiteral<null> {
  return new ASTLiteral(null, value.pos);
}

type TokenRange = [Token<TokenKind> | undefined, Token<TokenKind> | undefined];

type Binding = {key: string; value: ASTNode<unknown>};

function applyBinding([key, value]: [
  Token<TokenKind.Identifier>,
  ASTNode<unknown>
]): Binding {
  return {key: key.text, value};
}

function applyObject(
  bindings: Binding[] | undefined,
  tokenRange: TokenRange
): ASTNode<unknown> {
  // TODO: sort out position
  // TODO: tokenRange can be undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, ASTNode<any>> = {};
  for (const {key, value} of bindings || []) {
    // Validate property name while checking for duplicate keys.
    if (saferGet(result, key)) {
      throw new ErrorEx(ErrorCode.DUPLICATE_KEY, `Duplicate key "${key}".`);
    }
    result[key] = value;
  }
  return new ASTObject(result, tokenRange[0]!.pos);
}

function applyTuple(
  value: ASTNode<unknown>[] | undefined,
  tokenRange: TokenRange
): ASTTuple<unknown[]> {
  // TODO: sort out position
  // TODO: tokenRange can be undefined
  return new ASTTuple(value ?? [], tokenRange[0]!.pos);
}

function applyIdentifier(value: Token<TokenKind.Identifier>): ASTReference {
  return new ASTReference(value.text, value.pos);
}

function applyTemplate(
  value: Token<
    | TokenKind.TemplateComplete
    | TokenKind.TemplateLeft
    | TokenKind.TemplateMiddle
    | TokenKind.TemplateRight
  >
): ASTNode<string> {
  if (
    value.kind === TokenKind.TemplateComplete ||
    value.kind === TokenKind.TemplateRight
  ) {
    return new ASTLiteral(value.text.slice(1, -1), value.pos);
  } else {
    return new ASTLiteral(value.text.slice(1, -2), value.pos);
  }
}

function applyTemplate2(
  [left, first, middle, right]: [
    ASTNode<string>,
    ASTNode<unknown>,
    [ASTNode<string>, ASTNode<unknown>][] | undefined,
    ASTNode<string>
  ],
  tokenRange: TokenRange
): ASTTemplate {
  const elements = [left, first, ...(middle || []), right].flat();
  return new ASTTemplate(elements, tokenRange[0]!.pos);
}
function applyArrayIndex(
  [array, index]: [ASTNode<unknown>, ASTNode<unknown>],
  tokenRange: TokenRange
) {
  return new ASTIndex(array, index, tokenRange[0]!.pos);
}

function applyDot(
  [parent, first, rest]: [
    ASTNode<unknown>,
    Token<TokenKind.Identifier>,
    Token<TokenKind.Identifier>[]
  ],
  tokenRange: TokenRange
): ASTNode<unknown> {
  const path = [first, ...rest];
  const result = path.reduce(
    (accumulator: ASTNode<unknown>, current: Token<TokenKind.Identifier>) => {
      return new ASTDot(
        accumulator,
        new ASTReference(current.text, tokenRange[0]!.pos),
        tokenRange[0]!.pos
      );
    },
    parent
  );

  return result;
}

function applyFunction(
  [symbol, params]: [
    Token<TokenKind.Identifier>,
    ASTNode<unknown>[] | undefined
  ],
  tokenRange: TokenRange
): ASTFunction<unknown[]> {
  return new ASTFunction(
    new ASTReference(symbol.text, tokenRange[0]!.pos),
    params || [],
    tokenRange[0]!.pos
  );
}

function applyProgram(
  [aliases, token, root]: [
    Binding[],
    Token<TokenKind.Return> | Token<TokenKind.Use>,
    ASTNode<unknown>
  ],
  tokenRange: TokenRange
): ASTProgram {
  const locals: Record<string, ASTNode<unknown>> = {};
  for (const {key, value} of aliases) {
    // Validate property name while checking for duplicate keys.
    if (saferGet(locals, key)) {
      throw new ErrorEx(ErrorCode.DUPLICATE_KEY, `Duplicate key "${key}".`);
    }
    locals[key] = value;
  }
  return new ASTProgram(
    locals,
    root,
    token.kind === TokenKind.Return ? Action.Return : Action.Use,
    tokenRange[0]!.pos
  );
}

const ALIAS_DEC = rule<TokenKind, Binding>();
const ARRAY_INDEX_EXPR = rule<TokenKind, ASTNode<unknown>>();
const BINDING = rule<TokenKind, Binding>();
const DOT_EXPR = rule<TokenKind, ASTNode<unknown>>();
const EXPR = rule<TokenKind, ASTNode<unknown>>();
const EXPR2 = rule<TokenKind, ASTNode<unknown>>();
const FUNCTION_CALL = rule<TokenKind, ASTNode<unknown>>();
const IDENTIFIER = rule<TokenKind, ASTNode<unknown>>();
const LITERAL_EXPR = rule<TokenKind, ASTNode<unknown>>();
const OBJECT = rule<TokenKind, ASTNode<unknown>>();
const PROGRAM = rule<TokenKind, ASTProgram>();
const TEMPLATE_LITERAL = rule<TokenKind, ASTNode<string>>();
const TUPLE = rule<TokenKind, ASTNode<unknown>>();

PROGRAM.setPattern(
  apply(
    seq(
      rep_sc(ALIAS_DEC),
      alt(tok(TokenKind.Use), tok(TokenKind.Return)),
      kleft(EXPR2, opt(tok(TokenKind.Semicolon)))
    ),
    applyProgram
  )
);

ALIAS_DEC.setPattern(
  apply(
    seq(
      tok(TokenKind.Identifier),
      kmid(tok(TokenKind.Equals), EXPR2, opt(tok(TokenKind.Semicolon)))
    ),
    applyBinding
  )
);

EXPR2.setPattern(alt(DOT_EXPR, ARRAY_INDEX_EXPR, EXPR));
// EXPR2.setPattern(alt(DOT_EXPR, FUNCTION_CALL, ARRAY_INDEX_EXPR, EXPR));

DOT_EXPR.setPattern(
  apply(
    seq(
      EXPR,
      kright(tok(TokenKind.Dot), tok(TokenKind.Identifier)),
      rep_sc(kright(tok(TokenKind.Dot), tok(TokenKind.Identifier)))
    ),
    applyDot
  )
);

ARRAY_INDEX_EXPR.setPattern(
  apply(
    seq(EXPR, kmid(tok(TokenKind.LBracket), EXPR2, tok(TokenKind.RBracket))),
    applyArrayIndex
  )
);

EXPR.setPattern(alt(LITERAL_EXPR, FUNCTION_CALL, IDENTIFIER, TEMPLATE_LITERAL));

IDENTIFIER.setPattern(apply(tok(TokenKind.Identifier), applyIdentifier));

LITERAL_EXPR.setPattern(
  alt(
    apply(tok(TokenKind.Number), applyNumber),
    apply(tok(TokenKind.String), applyString),
    apply(tok(TokenKind.Boolean), applyBoolean),
    apply(tok(TokenKind.Undefined), applyUndefined),
    apply(tok(TokenKind.Null), applyNull),
    OBJECT,
    TUPLE
  )
);

TEMPLATE_LITERAL.setPattern(
  alt(
    apply(tok(TokenKind.TemplateComplete), applyTemplate),
    apply(
      seq(
        apply(tok(TokenKind.TemplateLeft), applyTemplate),
        EXPR2,
        opt_sc(
          rep_sc(
            seq(
              apply(templateTok(TokenKind.TemplateMiddle), applyTemplate),
              EXPR2
            )
          )
        ),
        apply(templateTok(TokenKind.TemplateRight), applyTemplate)
      ),
      applyTemplate2
    )
  )
);

FUNCTION_CALL.setPattern(
  apply(
    seq(
      tok(TokenKind.Identifier),
      kmid(
        tok(TokenKind.LParen),
        opt(list_sc(EXPR2, tok(TokenKind.Comma))),
        tok(TokenKind.RParen)
      )
    ),
    applyFunction
  )
);

OBJECT.setPattern(
  apply(
    kmid(
      tok(TokenKind.LBrace),
      opt(list_sc(BINDING, tok(TokenKind.Comma))),
      tok(TokenKind.RBrace)
    ),
    applyObject
  )
);

BINDING.setPattern(
  apply(
    seq(tok(TokenKind.Identifier), kright(tok(TokenKind.Colon), EXPR2)),
    applyBinding
  )
);

TUPLE.setPattern(
  apply(
    kmid(
      tok(TokenKind.LBracket),
      opt(list_sc(EXPR2, tok(TokenKind.Comma))),
      tok(TokenKind.RBracket)
    ),
    applyTuple
  )
);

export function parseExpression(text: string): ASTNode<unknown> {
  const lexer = createLexer2();
  return expectSingleResult(expectEOF(EXPR2.parse(lexer.parse(text))));
}

export function parse(text: string): ASTProgram {
  const lexer = createLexer2();
  return expectSingleResult(expectEOF(PROGRAM.parse(lexer.parse(text))));
}
