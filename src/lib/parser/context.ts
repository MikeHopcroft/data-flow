import z from 'zod';

import {ASTNode, Function, IEvaluationContext} from '../interfaces';

import {ErrorCode, ErrorEx} from './errors';

type ContextOptions = {
  allowUnapprovedFunctions?: boolean;
};

export class Context implements IEvaluationContext {
  // Global external symbols.
  values: Record<string, unknown>;

  // List of approved functions.
  approved: Map<Function, z.ZodType>;

  // Internal referencces to aliased ASTNodes.
  nodes: Record<string, ASTNode<unknown>>;

  options: ContextOptions;

  // Cache of resolved ASTNodes.
  resolved: Record<string, ASTNode<unknown>> = {};

  // Cache of evaluated ASTNodes.
  cache = new Map<ASTNode<unknown>, unknown>();

  // Nodes that are active in the current evaluation chain.
  // Used to detect cycles.
  active = new Set<ASTNode<unknown>>();

  // Path of active nodes in the current evaluation chain.
  // Used to format error messages for cycles.
  path: string[] = [];

  private constructor(
    values: Record<string, unknown>,
    approved: Map<Function, z.ZodType>,
    nodes: Record<string, ASTNode<unknown>>,
    options?: ContextOptions
  ) {
    this.values = values;
    this.approved = approved;
    this.nodes = nodes;
    this.options = options || {};
  }

  static create(
    values: Record<string, unknown>,
    approved: [Function, z.ZodType][] | undefined,
    nodes: Record<string, ASTNode<unknown>>
  ): Context {
    const approvedMap = new Map<Function, z.ZodType>(approved || []);
    return new Context(values, approvedMap, nodes);
  }

  derive(
    values?: Record<string, unknown>,
    locals?: Record<string, ASTNode<unknown>>
  ): Context {
    return new Context(
      values || this.values,
      this.approved,
      locals || this.nodes
    );
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

  get(name: string): {
    value?: unknown;
    node?: ASTNode<unknown>;
    resolved?: boolean;
  } {
    const resolvedNode = saferGet(this.resolved, name) as ASTNode<unknown>;
    if (resolvedNode) {
      return {node: resolvedNode, resolved: true};
    }

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

  resolve(name: string, node: ASTNode<unknown>): void {
    saferGet(this.nodes, name) as ASTNode<unknown>;
    if (name in this.resolved) {
      throw new ErrorEx(
        ErrorCode.INTERNAL_ERROR,
        `Key "${name}" has already been resolved.`
      );
    }
    this.resolved[name] = node;
  }

  getParamsValidator(f: Function): z.ZodType {
    let validator = this.approved.get(f);
    if (!validator) {
      if (!this.options.allowUnapprovedFunctions) {
        throw new ErrorEx(
          ErrorCode.UNAPPROVED_FUNCTION,
          `Unapproved function: ${f.name}`
        );
      }
      validator = z.any();
    }
    return validator;
  }
}

const identiferReSource = '^[a-zA-Z][a-zA-Z0-9_]*';
export const identifierReForLexer = new RegExp(identiferReSource, 'g');
const identifierReForSafeGet = new RegExp(identiferReSource + '$');

// The goal here is to reduce opportunities for  injection attacks to access
// properties other than those intended. This includes fields like __proto__
// and toString.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saferGet<T extends Record<keyof T, any>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<keyof T, any>,
  name: keyof T
) {
  if (!identifierReForSafeGet.test(name as string)) {
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
