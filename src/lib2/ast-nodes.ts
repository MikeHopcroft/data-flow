import {TokenPosition} from 'typescript-parsec';

import {Context, saferGet} from './context';
import {ASTNode, IEvaluationContext} from './interfaces';

type MapAST<T extends readonly unknown[] | [] | Record<keyof T, unknown>> = {
  -readonly [P in keyof T]: ASTNode<T[P]>;
};

export enum RuntimeErrorCode {
  ILLEGAL_IDENTIFIER,
  INACCESSIBLE_PROPERTY,
  EXPECTED_ARRAY,
  EXPECTED_ARRAY_INDEX,
  EXPECTED_FUNCTION,
  EXPECTED_OBJECT,
  UNKNOWN_IDENTIFIER,
}

const runtimeErrorStrings = [
  'Illegal identifier',
  'Inaccessible property',
  'Expected an array.',
  'Expected an array index.',
  'Expected a function.',
  'Expected an object.',
  'Unknown identifier.',
];

export class RuntimeError extends Error {
  code: RuntimeErrorCode;

  constructor(code: RuntimeErrorCode, message?: string) {
    super(message || runtimeErrorStrings[code]);
    this.code = code;
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTLiteral
//
///////////////////////////////////////////////////////////////////////////////
type FunctionValue = (...params: unknown[]) => Promise<unknown>;
export type Literal = string | number | boolean | FunctionValue | undefined;

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

// function test<S, T extends {[key: keyof T]: S}>(context: T, name: keyof T) {
//   return context[name];
// }

// type MapAST2<T extends Record<keyof T, any>> = {
//   -readonly [X in keyof T]: ASTNode<T[X]>;
// };
// type MapAST2<T extends Record<keyof T, any>> = {
//   [X in keyof T]: ASTNode<T[X]>;
// };
type MapAST2<T extends Record<string, any>> = {
  [X in keyof T]: ASTNode<T[X]>;
};

// function test<S, T extends Record<keyof T, S>>(context: T, name: keyof T) {
//   return context[name];
// }
function test<T extends Record<keyof T, any>>(
  context: Record<keyof T, any>,
  name: keyof T
) {
  return context[name];
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
    const promises: Promise<any>[] = [];
    for (const key of Object.getOwnPropertyNames(this.value)) {
      // const v = this.value[key as keyof MapAST2<X>];
      // const v2 = test(this.value, key as keyof X);
      const value = saferGet(this.value, key as keyof X) as any;
      // const x = value!.eval(context);
      // if (value === undefined) {
      //   throw 123;
      // }
      promises.push(value.eval(context));
      // promises.push(value!.eval(context));
      // promises.push(v2!.eval(context));
    }
    const values = await Promise.all(promises);
    const result: Record<string, any> = {};
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
    const {value, node} = context.get(this.name);
    if (node) {
      return await node.eval(context);
    } else if (value !== undefined) {
      return value;
    }
    throw new RuntimeError(
      RuntimeErrorCode.UNKNOWN_IDENTIFIER,
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
      throw new RuntimeError(RuntimeErrorCode.EXPECTED_FUNCTION);
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
      throw new RuntimeError(
        RuntimeErrorCode.EXPECTED_OBJECT,
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
      throw new RuntimeError(
        RuntimeErrorCode.EXPECTED_ARRAY,
        'Expected array.'
      );
    }
    if (typeof index !== 'number') {
      throw new RuntimeError(
        RuntimeErrorCode.EXPECTED_ARRAY_INDEX,
        'Array index must be number.'
      );
    }
    return array[index];
  }
}
