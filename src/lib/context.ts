import {ErrorCode, ErrorEx} from './errors';
import {ASTNode, IEvaluationContext} from './interfaces';

export class Context implements IEvaluationContext {
  values: Record<string, unknown>;
  nodes: Record<string, ASTNode<unknown>>;
  cache = new Map<ASTNode<unknown>, unknown>();
  active = new Set<ASTNode<unknown>>();
  path: string[] = [];

  constructor(
    values: Record<string, unknown>,
    nodes: Record<string, ASTNode<unknown>>
  ) {
    this.values = values;
    this.nodes = nodes;
  }

  eval(name: string): {value: unknown} | undefined {
    const node = saferGet(this.nodes, name) as ASTNode<unknown>;
    if (node) {
      if (this.cache.has(node)) {
        return {value: this.cache.get(node)};
      } else {
        if (this.active.has(node)) {
          throw new ErrorEx(
            ErrorCode.CYCLE_DETECTED,
            `Cycle detected (path: ${this.path.join(' -> ')})`
          );
        }
        let value: unknown;
        try {
          this.active.add(node);
          this.path.push(name);
          value = node.eval(this);
          this.cache.set(node, value);
        } finally {
          this.path.pop();
          this.active.delete(node);
        }
        return {value};
      }
    }

    const value = saferGet(this.values, name);
    if (value) {
      return {value};
    }

    return undefined;
  }

  get(name: string): {value?: unknown; node?: ASTNode<unknown>} {
    const node = saferGet(this.nodes, name) as ASTNode<unknown>;
    if (node) {
      return {node};
    }

    const value = saferGet(this.values, name);
    if (value) {
      return {value};
    }

    return {};
  }
}

// The goal here is to reduce opportunities for  injection attacks to access
// properties other than those intended. This includes fields like __proto__
// and toString.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saferGet<T extends Record<keyof T, any>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<keyof T, any>,
  name: keyof T
) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name as string)) {
    throw new ErrorEx(
      ErrorCode.ILLEGAL_IDENTIFIER,
      `Illegal property name "${name as string}".`
    );
  }

  if (name in {}) {
    throw new ErrorEx(
      ErrorCode.INACCESSIBLE_PROPERTY,
      `Inaccessible property name "${name as string}".`
    );
  }

  if (name in context) {
    if (!Object.hasOwn(context, name)) {
      throw new ErrorEx(
        ErrorCode.INACCESSIBLE_PROPERTY,
        `Inaccessible property name "${name as string}".`
      );
    }
    return context[name];
  }
  return undefined;
}
