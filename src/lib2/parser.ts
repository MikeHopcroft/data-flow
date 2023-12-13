// import {
//   alt,
//   apply,
//   buildLexer,
//   expectEOF,
//   expectSingleResult,
//   kmid,
//   list_sc,
//   opt,
//   rep_sc,
//   rule,
//   seq,
//   tok,
//   Token,
// } from 'typescript-parsec';

// import {
//   ASTFunction,
//   ASTLiteral,
//   ASTReference,
//   ASTTuple,
//   // booleanLiteral,
//   // numberLiteral,
//   // stringLiteral,
// } from './ast-nodes';

// import {ASTNode} from './interfaces';

// enum TokenKind {
//   Number,
//   String,
//   Boolean,
//   Use,
//   Return,
//   Identifier,
//   LBracket,
//   RBracket,
//   LParen,
//   RParen,
//   Comma,
//   Equals,
//   Space,
//   Comment,
// }

// const lexer = buildLexer([
//   [true, /^-?\d+(\.\d+)?/g, TokenKind.Number],
//   [true, /^"[^"]*"/g, TokenKind.String],
//   [true, /^(true|false)/g, TokenKind.Boolean],
//   [true, /^use/g, TokenKind.Use],
//   [true, /^return/g, TokenKind.Return],
//   [true, /^[a-zA-Z_]+[a-zA-Z_0-9]*/g, TokenKind.Identifier],
//   [true, /^\[/g, TokenKind.LBracket],
//   [true, /^\]/g, TokenKind.RBracket],
//   [true, /^\(/g, TokenKind.LParen],
//   [true, /^\)/g, TokenKind.RParen],
//   [true, /^,/g, TokenKind.Comma],
//   [true, /^=/g, TokenKind.Equals],
//   [false, /^\/\/[^\n]*/g, TokenKind.Comment],
//   [false, /^\s+/g, TokenKind.Space],
// ]);

// // VARDEC = Identifier Equals EXPR
// //
// // LIST = EXPR [, EXPR]*
// //
// // ARRAY = LBracket LIST RBracket
// //
// // CALL = Identifier LParen LIST RParen
// //
// // EXPR =
// //   Number
// //   String
// //   Boolean
// //   ARRAY
// //   CALL
// //   Identifier
// //
// // USE = 'use' EXPR
// // RETURN = 'return' EXPR
// //
// // PROGRAM = VARDEC* (USE | RETURN)

// // import {SymbolTable} from './symbol-table';

// function applyNumber(value: Token<TokenKind.Number>): ASTLiteral<number> {
//   return new ASTLiteral(Number(value.text), value.pos);
// }

// function applyIdentifier(value: Token<TokenKind.Identifier>): ASTReference {
//   return new ASTReference(value.text, value.pos);
// }

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

// function applyString(value: Token<TokenKind.String>): ASTLiteral<string> {
//   return new ASTLiteral(value.text.slice(1, -1), value.pos);
// }

// function applyBoolean(value: Token<TokenKind.Boolean>): ASTLiteral<boolean> {
//   return new ASTLiteral(value.text === 'true', value.pos);
// }

// type TokenRange = [Token<TokenKind> | undefined, Token<TokenKind> | undefined];

// function applyTuple(
//   value: ASTNode<unknown>[] | undefined,
//   tokenRange: TokenRange
// ): ASTTuple<unknown[]> {
//   // TODO: sort out position
//   // TODO: tokenRange can be undefined
//   return new ASTTuple(value ?? [], tokenRange[0]!.pos);
// }

// function applyFunction(
//   [symbol, params]: [
//     Token<TokenKind.Identifier>,
//     ASTNode<unknown>[] | undefined
//   ],
//   tokenRange: TokenRange
// ): ASTFunction<unknown[]> {
//   return new ASTFunction(symbol.text, params || [], tokenRange[0]!.pos);
// }

// const EXPR = rule<TokenKind, ASTNode<unknown>>();

// EXPR.setPattern(
//   alt(
//     apply(tok(TokenKind.Number), applyNumber),
//     apply(tok(TokenKind.String), applyString),
//     apply(tok(TokenKind.Boolean), applyBoolean),
//     apply(
//       seq(
//         tok(TokenKind.Identifier),
//         kmid(
//           tok(TokenKind.LParen),
//           opt(list_sc(EXPR, tok(TokenKind.Comma))),
//           tok(TokenKind.RParen)
//         )
//       ),
//       applyFunction
//     ),
//     apply(tok(TokenKind.Identifier), applyIdentifier),
//     apply(
//       kmid(
//         tok(TokenKind.LBracket),
//         opt(list_sc(EXPR, tok(TokenKind.Comma))),
//         tok(TokenKind.RBracket)
//       ),
//       applyTuple
//     )
//   )
// );

// const LITERAL_EXPR = rule<TokenKind, ASTNode<unknown>>();

// LITERAL_EXPR.setPattern(
//   alt(
//     apply(tok(TokenKind.Number), applyNumber),
//     apply(tok(TokenKind.String), applyString),
//     apply(tok(TokenKind.Boolean), applyBoolean),
//     apply(
//       kmid(
//         tok(TokenKind.LBracket),
//         opt(list_sc(LITERAL_EXPR, tok(TokenKind.Comma))),
//         tok(TokenKind.RBracket)
//       ),
//       applyTuple
//     )
//   )
// );

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

// export function parseLiteral(text: string): ASTNode<unknown> {
//   return expectSingleResult(expectEOF(LITERAL_EXPR.parse(lexer.parse(text))));
// }
