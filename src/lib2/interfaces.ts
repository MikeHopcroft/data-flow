import {TokenPosition} from 'typescript-parsec';

// import * as t from './dsl/types';

// export interface ISymbolTable {
//   add<T>(name: string, value: ASTNode<T>): void;
//   get(name: string): ASTNode<unknown>;
// }

export type Primitive = boolean | number | string | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Function = (...args: any[]) => Value;
export type Value = Arr | Obj | Primitive | Function;
export type Obj = {[key: string]: Value};
export type Arr = Array<Value>;

export interface ITypeCheckingContext {
  lookup(symbol: string): ASTNode<unknown>;
  push(node: ASTNodeBase): void;
  pop(): void;
  enterScope(symbol: string): void;
  exitScope(symbol: string): void;
  // skill(name: string): Skill<unknown[], unknown>;
}

export interface IEvaluationContext {
  get(name: string): {value?: unknown; node?: ASTNode<unknown>};
  eval(name: string): {value: unknown} | undefined;
}

export interface ASTNodeBase {
  position: TokenPosition;
}

export interface ASTNode<T> extends ASTNodeBase {
  // check(context: ITypeCheckingContext): t.Type<unknown>;
  eval(context: IEvaluationContext): Promise<T>;
}
