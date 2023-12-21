import {TokenPosition} from 'typescript-parsec';

import {Context, saferGet} from './context';
import {ErrorCode, ErrorEx} from './errors';
import {ASTNode, IEvaluationContext} from './interfaces';

type MapAST<T extends readonly unknown[] | [] | Record<keyof T, unknown>> = {
  -readonly [P in keyof T]: ASTNode<T[P]>;
};

type MapAST2<T extends Record<string, unknown>> = {
  [X in keyof T]: ASTNode<T[X]>;
};

///////////////////////////////////////////////////////////////////////////////
//
// ASTLiteral
//
///////////////////////////////////////////////////////////////////////////////
type FunctionValue = (...params: unknown[]) => Promise<unknown>;
export type Literal =
  | string
  | number
  | boolean
  | FunctionValue
  | undefined
  | null;

export class ASTLiteral<T extends Literal> implements ASTNode<T> {
  position: TokenPosition;
  value: T;

  constructor(value: T, position: TokenPosition) {
    this.value = value;
    this.position = position;
  }

  eval() {
    return Promise.resolve(this.value);
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTTemplate
//
///////////////////////////////////////////////////////////////////////////////
export class ASTTemplate implements ASTNode<string> {
  position: TokenPosition;
  elements: ASTNode<unknown>[];

  constructor(elements: ASTNode<unknown>[], position: TokenPosition) {
    this.elements = elements;
    this.position = position;
  }

  async eval(context: IEvaluationContext): Promise<string> {
    const promises = this.elements.map(p => p.eval(context));
    return (await Promise.all(promises)).join('');
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTTuple
//
///////////////////////////////////////////////////////////////////////////////
export class ASTTuple<P extends unknown[]> implements ASTNode<P> {
  elements: MapAST<P>;
  position: TokenPosition;

  constructor(elements: MapAST<P>, position: TokenPosition) {
    this.elements = elements;
    this.position = position;
  }

  async eval(context: IEvaluationContext): Promise<P> {
    const promises = this.elements.map(p => p.eval(context));
    return (await Promise.all(promises)) as P;
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTObject
//
///////////////////////////////////////////////////////////////////////////////
export class ASTObject<X extends Record<keyof X, unknown>>
  implements ASTNode<X>
{
  value: MapAST2<X>;
  position: TokenPosition;

  constructor(value: MapAST2<X>, position: TokenPosition) {
    this.value = value;
    this.position = position;
  }

  async eval(context: IEvaluationContext): Promise<X> {
    const promises: Promise<unknown>[] = [];
    for (const key of Object.getOwnPropertyNames(this.value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = saferGet(this.value, key as keyof X) as any;
      promises.push(value.eval(context));
    }
    const values = await Promise.all(promises);
    const result: Record<string, unknown> = {};
    let index = 0;
    for (const key of Object.getOwnPropertyNames(this.value)) {
      result[key] = values[index];
      ++index;
    }
    return result as X;
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTReference
//
///////////////////////////////////////////////////////////////////////////////
export class ASTReference implements ASTNode<unknown> {
  name: string;
  position: TokenPosition;

  constructor(name: string, position: TokenPosition) {
    this.name = name;
    this.position = position;
  }

  async eval(context: IEvaluationContext) {
    const result = context.eval(this.name);
    if (result !== undefined) {
      return result.value;
    }
    throw new ErrorEx(
      ErrorCode.UNKNOWN_IDENTIFIER,
      `Unknown identifier "${this.name}".`
    );
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTFunction
//
///////////////////////////////////////////////////////////////////////////////
export class ASTFunction<P extends unknown[]> implements ASTNode<unknown> {
  // name: string;
  func: ASTNode<unknown>;
  params: MapAST<P>;
  position: TokenPosition;

  constructor(
    func: ASTNode<unknown>,
    params: MapAST<P>,
    position: TokenPosition
  ) {
    this.func = func;
    this.params = params;
    this.position = position;
  }

  async eval(context: IEvaluationContext) {
    const promises = [
      this.func.eval(context),
      ...this.params.map(p => p.eval(context)),
    ];
    const [f, ...params] = await Promise.all(promises);

    if (typeof f !== 'function') {
      throw new ErrorEx(ErrorCode.EXPECTED_FUNCTION);
    }

    return f(...params);
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTDot
//
///////////////////////////////////////////////////////////////////////////////
export class ASTDot implements ASTNode<unknown> {
  parent: ASTNode<unknown>;
  child: ASTReference;
  position: TokenPosition;

  constructor(
    parent: ASTNode<unknown>,
    child: ASTReference,
    position: TokenPosition
  ) {
    this.parent = parent;
    this.child = child;
    this.position = position;
  }

  async eval(context: IEvaluationContext) {
    const parent = await this.parent.eval(context);
    if (
      typeof parent !== 'object' ||
      parent instanceof Array ||
      parent === null
    ) {
      throw new ErrorEx(
        ErrorCode.EXPECTED_OBJECT,
        'Left side of dot expression should be object.'
      );
    }
    return this.child.eval(new Context(parent as Record<string, unknown>, {}));
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTIndex
//
///////////////////////////////////////////////////////////////////////////////
export class ASTIndex implements ASTNode<unknown> {
  array: ASTNode<unknown>;
  index: ASTNode<unknown>;
  position: TokenPosition;

  constructor(
    array: ASTNode<unknown>,
    index: ASTNode<unknown>,
    position: TokenPosition
  ) {
    this.array = array;
    this.index = index;
    this.position = position;
  }

  async eval(context: IEvaluationContext) {
    const [array, index] = await Promise.all([
      this.array.eval(context),
      this.index.eval(context),
    ]);
    if (!(array instanceof Array)) {
      throw new ErrorEx(ErrorCode.EXPECTED_ARRAY, 'Expected array.');
    }
    if (typeof index !== 'number') {
      throw new ErrorEx(
        ErrorCode.EXPECTED_ARRAY_INDEX,
        'Array index must be number.'
      );
    }
    return array[index];
  }
}
