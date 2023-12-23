import {TokenPosition} from 'typescript-parsec';

export type Primitive = boolean | number | string | undefined;
export type Value = Arr | Obj | Primitive | Function;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Function = (...args: unknown[]) => Value;
export type Obj = {[key: string]: Value};
export type Arr = Array<Value>;

export interface IEvaluationContext {
  get(name: string): {
    value?: unknown;
    node?: ASTNode<unknown>;
    resolved?: boolean;
  };
  eval(name: string): {value: unknown} | undefined;
  resolve(name: string, node: ASTNode<unknown>): void;
}

export interface ASTNodeBase {
  position: TokenPosition;
}

export interface ASTNode<T> extends ASTNodeBase {
  eval(context: IEvaluationContext): Promise<T>;
  resolve(context: IEvaluationContext): ASTNode<T>;
  serialize(): string;
  // visit(visitor: Visitor<T>): ASTNode<T>;
}

export type Visitor<T> = (node: ASTNode<T>) => void;
