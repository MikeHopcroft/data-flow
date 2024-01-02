import jsesc from 'jsesc';
import {TokenPosition} from 'typescript-parsec';

import {ASTNode, Function, IEvaluationContext, Visitor} from '../interfaces';

import {saferGet} from './context';
import {ErrorCode, ErrorEx} from './errors';

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

  serialize() {
    if (typeof this.value === 'string') {
      return "'" + jsesc(this.value) + "'";
    } else {
      return jsesc(this.value);
    }
  }

  resolve(): ASTNode<T> {
    return this;
  }

  visit(visitor: Visitor) {
    visitor(this);
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

  serialize() {
    return (
      '`' +
      this.elements
        .map(p => {
          if (p instanceof ASTLiteral) {
            const value = p.value;
            if (typeof value === 'string') {
              return jsesc(value);
            } else {
              return p.serialize();
            }
          } else {
            return `\${${p.serialize()}}`;
          }
        })
        .join('') +
      '`'
    );
  }

  resolve(context: IEvaluationContext): ASTNode<string> {
    const elements = transform(this.elements, p => p.resolve(context));
    return elements === this.elements
      ? this
      : new ASTTemplate(elements, this.position);
  }

  visit(visitor: Visitor): void {
    visitor(this);
    for (const element of this.elements) {
      element.visit(visitor);
    }
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

  serialize(): string {
    return `[${this.elements.map(p => p.serialize()).join(',')}]`;
  }

  resolve(context: IEvaluationContext): ASTNode<P> {
    const elements = transform(this.elements, p =>
      p.resolve(context)
    ) as MapAST<P>;
    return elements === this.elements
      ? this
      : new ASTTuple(elements, this.position);
  }

  visit(visitor: Visitor): void {
    visitor(this);
    for (const element of this.elements) {
      element.visit(visitor);
    }
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

  serialize(): string {
    return (
      '{' +
      Object.getOwnPropertyNames(this.value)
        .map(
          key =>
            `${key}:${(
              saferGet(this.value, key as keyof X) as ASTNode<unknown>
            ).serialize()}`
        )
        .join(',') +
      '}'
    );
  }

  resolve(context: IEvaluationContext): ASTNode<X> {
    let changed = false;
    const values: ASTNode<unknown>[] = [];
    for (const key of Object.getOwnPropertyNames(this.value)) {
      const value = saferGet(this.value, key as keyof X) as ASTNode<unknown>;
      const transformed = value.resolve(context);
      if (value !== transformed) {
        changed = true;
      }
      values.push(transformed);
    }
    if (changed) {
      const result: Record<string, unknown> = {};
      let index = 0;
      for (const key of Object.getOwnPropertyNames(this.value)) {
        result[key] = values[index];
        ++index;
      }
      return new ASTObject(result as MapAST2<X>, this.position);
    } else {
      return this;
    }
  }

  visit(visitor: Visitor): void {
    visitor(this);
    for (const key of Object.getOwnPropertyNames(this.value)) {
      const value = saferGet(this.value, key as keyof X) as ASTNode<unknown>;
      value.visit(visitor);
    }
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

  serialize() {
    return this.name;
  }

  resolve(context: IEvaluationContext): ASTNode<unknown> {
    const value = context.get(this.name);
    if (value.node !== undefined) {
      // This is an ASTNode reference.
      let node = value.node;
      if (!value.resolved) {
        node = value.node.resolve(context);
        context.resolve(this.name, node);
      }
      return node;
    }
    return this;
  }

  visit(visitor: Visitor): void {
    visitor(this);
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTFunction
//
///////////////////////////////////////////////////////////////////////////////
export class ASTFunction<P extends unknown[]> implements ASTNode<unknown> {
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
    const validator = context.getParamsValidator(f as Function);
    const validation = validator.safeParse(params);
    if (!validation.success) {
      throw new ErrorEx(ErrorCode.INVALID_PARAMS, validation.error.message);
    }

    return f(...params);
  }

  serialize(): string {
    return `${this.func.serialize()}(${this.params
      .map(p => p.serialize())
      .join(',')})`;
  }

  resolve(context: IEvaluationContext): ASTNode<unknown> {
    const params = transform(this.params, p => p.resolve(context));
    const func = this.func.resolve(context);
    return params === this.params && func === this.func
      ? this
      : new ASTFunction(func, params, this.position);
  }

  visit(visitor: Visitor): void {
    visitor(this);
    this.func.visit(visitor);
    for (const param of this.params) {
      param.visit(visitor);
    }
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
    return this.child.eval(context.derive(parent as Record<string, unknown>));
  }

  serialize(): string {
    return `${this.parent.serialize()}.${this.child.serialize()}`;
  }

  resolve(context: IEvaluationContext): ASTNode<unknown> {
    const parent = this.parent.resolve(context);
    const child = this.child.resolve(context);
    return parent === this.parent && child === this.child
      ? this
      : new ASTDot(parent, child as ASTReference, this.position);
  }

  visit(visitor: Visitor): void {
    visitor(this);
    this.parent.visit(visitor);
    this.child.visit(visitor);
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

  serialize(): string {
    return `${this.array.serialize()}[${this.index.serialize()}]`;
  }

  resolve(context: IEvaluationContext): ASTNode<unknown> {
    const array = this.array.resolve(context);
    const index = this.index.resolve(context);
    return array === this.array && index === this.index
      ? this
      : new ASTIndex(array, index, this.position);
  }

  visit(visitor: Visitor): void {
    visitor(this);
    this.array.visit(visitor);
    this.index.visit(visitor);
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// ASTProgram
//
///////////////////////////////////////////////////////////////////////////////
export enum Action {
  Use,
  Return,
}

export class ASTProgram implements ASTNode<unknown> {
  locals: Record<string, ASTNode<unknown>>;
  root: ASTNode<unknown>;
  action: Action;
  position: TokenPosition;

  constructor(
    locals: Record<string, ASTNode<unknown>>,
    root: ASTNode<unknown>,
    action: Action,
    position: TokenPosition
  ) {
    this.locals = locals;
    this.root = root;
    this.action = action;
    this.position = position;
  }

  eval(context: IEvaluationContext) {
    const derived = context.derive(undefined, this.locals);
    return this.root.eval(derived);
  }

  serialize(): string {
    const keys = Object.getOwnPropertyNames(this.locals).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const value = saferGet(this.locals, key).serialize();
      parts.push(`${key}=${value};`);
    }
    parts.push(
      `${
        this.action === Action.Return ? 'return' : 'use'
      } ${this.root.serialize()};`
    );
    return parts.join('');
  }

  resolve(context: IEvaluationContext): ASTNode<unknown> {
    const derived = context.derive(undefined, this.locals);
    const root = this.root.resolve(derived);
    return root === this.root
      ? this
      : new ASTProgram({}, root, this.action, this.position);
  }

  visit(visitor: Visitor): void {
    visitor(this);
    this.root.visit(visitor);
    for (const key of Object.getOwnPropertyNames(this.locals)) {
      const value = saferGet(this.locals, key) as ASTNode<unknown>;
      value.visit(visitor);
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// Utility functions
//
///////////////////////////////////////////////////////////////////////////////

// Maps a transformer function over an array of elements.
// Returns a new array if any element was changed, otherwise returns the
// original array.
function transform(
  elements: ASTNode<unknown>[],
  transformer: (x: ASTNode<unknown>) => ASTNode<unknown>
): ASTNode<unknown>[] {
  const result = elements.map(transformer);
  for (const [index, element] of elements.entries()) {
    if (result[index] !== element) {
      return result;
    }
  }
  // The elements array is unchanged.
  return elements;
}
