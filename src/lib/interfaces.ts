import {TokenPosition} from 'typescript-parsec';

export type Primitive = boolean | number | string | undefined;
export type Value = Arr | Obj | Primitive | Function;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Function = (...args: unknown[]) => Value;
export type Obj = {[key: string]: Value};
export type Arr = Array<Value>;

export interface IEvaluationContext {
  get(name: string): {value?: unknown; node?: ASTNode<unknown>};
  eval(name: string): {value: unknown} | undefined;
}

export interface ASTNodeBase {
  position: TokenPosition;
}

export interface ASTNode<T> extends ASTNodeBase {
  eval(context: IEvaluationContext): Promise<T>;
}
