import {
  alt,
  apply,
  expectEOF,
  expectSingleResult,
  kleft,
  kmid,
  kright,
  list_sc,
  lrec_sc,
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
import {createLexer2, templateTok, TokenKind} from './lexer';

// Parse a complete program.
export function parse(text: string): ASTProgram {
  const lexer = createLexer2();
  return expectSingleResult(expectEOF(PROGRAM.parse(lexer.parse(text))));
}

// Parses a single expression. Exposed for unit testing.
export function parseExpression(text: string): ASTNode<unknown> {
  const lexer = createLexer2();
  return expectSingleResult(
    expectEOF(GENERAL_EXPERSSION.parse(lexer.parse(text)))
  );
}
///////////////////////////////////////////////////////////////////////////////
//
// Parsers
//
///////////////////////////////////////////////////////////////////////////////
const ALIAS_DEC = rule<TokenKind, Binding>();
const ARRAY_INDEX_EXPR = rule<TokenKind, ASTNode<unknown>>();
const BINDING = rule<TokenKind, Binding>();
const DOT_EXPR = rule<TokenKind, Token<TokenKind.Identifier>>();
const SIMPLE_EXPR = rule<TokenKind, ASTNode<unknown>>();
const GENERAL_EXPERSSION = rule<TokenKind, ASTNode<unknown>>();
const FUNCTION_CALL = rule<TokenKind, ASTNode<unknown>[] | undefined>();
const IDENTIFIER = rule<TokenKind, ASTNode<unknown>>();
const LITERAL_EXPR = rule<TokenKind, ASTNode<unknown>>();
const OBJECT_LITERAL = rule<TokenKind, ASTNode<unknown>>();
const PROGRAM = rule<TokenKind, ASTProgram>();
const TEMPLATE_LITERAL = rule<TokenKind, ASTNode<string>>();
const TUPLE_LITERAL = rule<TokenKind, ASTNode<unknown>>();

PROGRAM.setPattern(
  apply(
    seq(
      rep_sc(ALIAS_DEC),
      alt(tok(TokenKind.Use), tok(TokenKind.Return)),
      kleft(GENERAL_EXPERSSION, opt(tok(TokenKind.Semicolon)))
    ),
    applyProgram
  )
);

ALIAS_DEC.setPattern(
  apply(
    seq(
      tok(TokenKind.Identifier),
      kmid(
        tok(TokenKind.Equals),
        GENERAL_EXPERSSION,
        opt(tok(TokenKind.Semicolon))
      )
    ),
    applyBinding
  )
);

GENERAL_EXPERSSION.setPattern(
  lrec_sc(
    SIMPLE_EXPR,
    alt(ARRAY_INDEX_EXPR, DOT_EXPR, FUNCTION_CALL),
    reduceGeneralExpression
  )
);

ARRAY_INDEX_EXPR.setPattern(
  kmid(tok(TokenKind.LBracket), GENERAL_EXPERSSION, tok(TokenKind.RBracket))
);

DOT_EXPR.setPattern(kright(tok(TokenKind.Dot), tok(TokenKind.Identifier)));

FUNCTION_CALL.setPattern(
  kmid(
    tok(TokenKind.LParen),
    opt(list_sc(GENERAL_EXPERSSION, tok(TokenKind.Comma))),
    tok(TokenKind.RParen)
  )
);

SIMPLE_EXPR.setPattern(alt(IDENTIFIER, LITERAL_EXPR, TEMPLATE_LITERAL));

IDENTIFIER.setPattern(apply(tok(TokenKind.Identifier), applyIdentifier));

LITERAL_EXPR.setPattern(
  alt(
    apply(tok(TokenKind.Boolean), applyBoolean),
    apply(tok(TokenKind.Null), applyNull),
    apply(tok(TokenKind.Number), applyNumber),
    apply(tok(TokenKind.String), applyString),
    apply(tok(TokenKind.Undefined), applyUndefined),
    OBJECT_LITERAL,
    TUPLE_LITERAL
  )
);

OBJECT_LITERAL.setPattern(
  apply(
    kmid(
      tok(TokenKind.LBrace),
      opt(list_sc(BINDING, tok(TokenKind.Comma))),
      tok(TokenKind.RBrace)
    ),
    applyObject
  )
);

TEMPLATE_LITERAL.setPattern(
  alt(
    apply(tok(TokenKind.TemplateComplete), applyTemplate),
    apply(
      seq(
        apply(tok(TokenKind.TemplateLeft), applyTemplate),
        GENERAL_EXPERSSION,
        opt_sc(
          rep_sc(
            seq(
              apply(templateTok(TokenKind.TemplateMiddle), applyTemplate),
              GENERAL_EXPERSSION
            )
          )
        ),
        apply(templateTok(TokenKind.TemplateRight), applyTemplate)
      ),
      applyTemplate2
    )
  )
);

BINDING.setPattern(
  apply(
    seq(
      tok(TokenKind.Identifier),
      kright(tok(TokenKind.Colon), GENERAL_EXPERSSION)
    ),
    applyBinding
  )
);

TUPLE_LITERAL.setPattern(
  apply(
    kmid(
      tok(TokenKind.LBracket),
      opt(list_sc(GENERAL_EXPERSSION, tok(TokenKind.Comma))),
      tok(TokenKind.RBracket)
    ),
    applyTuple
  )
);

///////////////////////////////////////////////////////////////////////////////
//
// Apply-functions
//
///////////////////////////////////////////////////////////////////////////////

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

function applyBinding([key, value]: [
  Token<TokenKind.Identifier>,
  ASTNode<unknown>
]): Binding {
  return {key: key.text, value};
}

function reduceGeneralExpression(
  left: ASTNode<unknown>,
  right:
    | ASTNode<unknown>
    | ASTNode<unknown>[]
    | Token<TokenKind.Identifier>
    | undefined
): ASTNode<unknown> {
  if (right === undefined || right instanceof Array) {
    return new ASTFunction(left, right || [], left.position);
  } else if ('kind' in right) {
    return new ASTDot(
      left,
      new ASTReference(right.text, right.pos),
      left.position
    );
  } else {
    return new ASTIndex(left, right, left.position);
  }
}

function applyNull(value: Token<TokenKind.Null>): ASTLiteral<null> {
  return new ASTLiteral(null, value.pos);
}

function applyBoolean(value: Token<TokenKind.Boolean>): ASTLiteral<boolean> {
  return new ASTLiteral(value.text === 'true', value.pos);
}

function applyIdentifier(value: Token<TokenKind.Identifier>): ASTReference {
  return new ASTReference(value.text, value.pos);
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

type TokenRange = [Token<TokenKind> | undefined, Token<TokenKind> | undefined];

type Binding = {key: string; value: ASTNode<unknown>};

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
