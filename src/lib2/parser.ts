import {
  alt,
  apply,
  expectEOF,
  expectSingleResult,
  kmid,
  kright,
  list_sc,
  opt,
  rep_sc,
  rule,
  seq,
  tok,
  Token,
} from 'typescript-parsec';

import {
  ASTDot,
  ASTFunction,
  ASTIndex,
  ASTLiteral,
  ASTObject,
  ASTReference,
  ASTTuple,
} from './ast-nodes';
import {ASTNode} from './interfaces';
import {createLexer, TokenKind} from './lexer';

// VARDEC = Identifier Equals EXPR
//
// LIST = EXPR [, EXPR]*
//
// TUPLE = LBracket LIST RBracket
//
// BINDING = IDENTIFIER ':' EXRP
// BINDING_LIST = BINDING [',' BINDING]*
// OBJECT = '{' BINDING_LIST? '}'
//
// FUNCTION_CALL = Identifier LParen LIST RParen
//
// LITERAL_EXPR =
//   Boolean
//   Number
//   String
//   TUPLE
//   OBJECT
//
// DOT_EXPR =
//
// ARRAY_INDEX
//
// EXPR =
//   LITERAL_EXPR
//   FUNCTION_CALL
//   IDENTIFIER
//
// EXPR2 =
//   DOT_EXPR
//   ARRAY_INDEX
//   EXPR
//
// USE = 'use' EXPR
// RETURN = 'return' EXPR
//
// PROGRAM = VARDEC* (USE | RETURN)

// // import {SymbolTable} from './symbol-table';

function applyBoolean(value: Token<TokenKind.Boolean>): ASTLiteral<boolean> {
  return new ASTLiteral(value.text === 'true', value.pos);
}

function applyNumber(value: Token<TokenKind.Number>): ASTLiteral<number> {
  return new ASTLiteral(Number(value.text), value.pos);
}

function applyString(value: Token<TokenKind.String>): ASTLiteral<string> {
  return new ASTLiteral(value.text.slice(1, -1), value.pos);
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
    // TODO: safe property set
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

// interface VarDec {
//   symbol: string;
//   node: ASTNode<unknown>;
// }

// function applyVarDec(
//   value: [
//     Token<TokenKind.Identifier>,
//     Token<TokenKind.Equals>,
//     ASTNode<unknown>
//   ]
// ): VarDec {
//   return {symbol: value[0].text, node: value[2]};
// }

function applyArrayIndex(
  [array, index]: [ASTNode<unknown>, ASTNode<unknown>],
  tokenRange: TokenRange
) {
  return new ASTIndex(array, index, tokenRange[0]!.pos);
}

// function applyDot(
//   [parent, child]: [ASTNode<unknown>, Token<TokenKind.Identifier>],
//   tokenRange: TokenRange
// ): ASTDot {
//   return new ASTDot(
//     parent,
//     new ASTReference(child.text, tokenRange[0]!.pos),
//     tokenRange[0]!.pos
//   );
// }

function applyDot2(
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

const LITERAL_EXPR = rule<TokenKind, ASTNode<unknown>>();

const BINDING = rule<TokenKind, Binding>();
const OBJECT = rule<TokenKind, ASTNode<unknown>>();
// kmid(tok(TokenKind.LBracket, TokenKind.RBracket))
const EXPR2 = rule<TokenKind, ASTNode<unknown>>();
const DOT_EXPR = rule<TokenKind, ASTNode<unknown>>();
const ARRAY_INDEX = rule<TokenKind, ASTNode<unknown[]>>();
const EXPR = rule<TokenKind, ASTNode<unknown>>();

BINDING.setPattern(
  apply(
    seq(tok(TokenKind.Identifier), kright(tok(TokenKind.Colon), EXPR)),
    applyBinding
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

LITERAL_EXPR.setPattern(
  alt(
    apply(tok(TokenKind.Number), applyNumber),
    apply(tok(TokenKind.String), applyString),
    apply(tok(TokenKind.Boolean), applyBoolean),
    apply(
      kmid(
        tok(TokenKind.LBracket),
        opt(list_sc(LITERAL_EXPR, tok(TokenKind.Comma))),
        tok(TokenKind.RBracket)
      ),
      applyTuple
    ),
    OBJECT
  )
);

EXPR.setPattern(
  alt(
    LITERAL_EXPR,
    //     apply(tok(TokenKind.Number), applyNumber),
    //     apply(tok(TokenKind.String), applyString),
    //     apply(tok(TokenKind.Boolean), applyBoolean),
    apply(
      seq(
        tok(TokenKind.Identifier),
        kmid(
          tok(TokenKind.LParen),
          opt(list_sc(EXPR, tok(TokenKind.Comma))),
          tok(TokenKind.RParen)
        )
      ),
      applyFunction
    ),
    // apply(
    //   seq(EXPR, lrec_sc(kright(tok(TokenKind.Dot), tok(TokenKind.Identifier)),)),
    //   applyDot
    // ),
    // apply(
    //   seq(kleft(EXPR, tok(TokenKind.Dot)), tok(TokenKind.Identifier)),
    //   applyDot
    // ),
    apply(tok(TokenKind.Identifier), applyIdentifier)
    // DOT_EXPR
    //     apply(
    //       kmid(
    //         tok(TokenKind.LBracket),
    //         opt(list_sc(EXPR, tok(TokenKind.Comma))),
    //         tok(TokenKind.RBracket)
    //       ),
    //       applyTuple
    //     )
  )
);

// DOT_EXPR.setPattern(
//   apply(
//     seq(kleft(EXPR, tok(TokenKind.Dot)), tok(TokenKind.Identifier)),
//     applyDot
//   )
// );
DOT_EXPR.setPattern(
  apply(
    seq(
      EXPR,
      kright(tok(TokenKind.Dot), tok(TokenKind.Identifier)),
      rep_sc(kright(tok(TokenKind.Dot), tok(TokenKind.Identifier)))
    ),
    applyDot2
  )
);

ARRAY_INDEX.setPattern(
  apply(
    seq(EXPR, kmid(tok(TokenKind.LBracket), EXPR, tok(TokenKind.RBracket))),
    applyArrayIndex
  )
);

EXPR2.setPattern(alt(DOT_EXPR, ARRAY_INDEX, EXPR));

// const VARDEC = rule<TokenKind, VarDec>();
// VARDEC.setPattern(
//   apply(
//     seq(tok(TokenKind.Identifier), tok(TokenKind.Equals), EXPR),
//     applyVarDec
//   )
// );

// const PROGRAM = rule<TokenKind, Program>();
// PROGRAM.setPattern(
//   apply(
//     seq(rep_sc(VARDEC), alt(tok(TokenKind.Use), tok(TokenKind.Return)), EXPR),
//     applyProgram
//   )
// );

// export enum Action {
//   Use,
//   Return,
// }

// export interface Program {
//   symbols: SymbolTable;
//   action: Action;
//   expression: ASTNode<unknown>;
// }

// function applyProgram([vardecs, action, expression]: [
//   VarDec[],
//   Token<TokenKind.Use> | Token<TokenKind.Return>,
//   ASTNode<unknown>
// ]): Program {
//   const symbols = new SymbolTable(vardecs.map(x => [x.symbol, x.node]));
//   return {
//     symbols,
//     action: action.kind === TokenKind.Use ? Action.Use : Action.Return,
//     expression,
//   };
// }

// export function parse(text: string): Program {
//   return expectSingleResult(expectEOF(PROGRAM.parse(lexer.parse(text))));
// }

export function parseLiteral(text: string): ASTNode<unknown> {
  const lexer = createLexer();
  return expectSingleResult(expectEOF(EXPR2.parse(lexer.parse(text))));
}
