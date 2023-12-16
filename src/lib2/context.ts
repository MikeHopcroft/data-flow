import {RuntimeError, RuntimeErrorCode} from './ast-nodes';
import {ASTNode, IEvaluationContext} from './interfaces';

export class Context implements IEvaluationContext {
  values: Record<string, unknown>;
  nodes: Record<string, ASTNode<unknown>>;

  constructor(
    values: Record<string, unknown>,
    nodes: Record<string, ASTNode<unknown>>
  ) {
    this.values = values;
    this.nodes = nodes;
  }

  get(name: string) {
    const node = saferGet(this.nodes, name);
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
// export function saferGet<T>(
//   context: Record<keyof T, T>,
//   name: string
// ): T | undefined {
//   if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
//     throw new RuntimeError(
//       RuntimeErrorCode.ILLEGAL_IDENTIFIER,
//       // EvaluationErrorCode.UNSAFE_PROPERTY,
//       `Illegal property name "${name}".`
//     );
//   }

//   if (name in {}) {
//     throw new RuntimeError(
//       RuntimeErrorCode.INACCESSIBLE_PROPERTY,
//       // EvaluationErrorCode.UNSAFE_PROPERTY,
//       `Inaccessible property name "${name}".`
//     );
//   }

//   if (name in context) {
//     if (!Object.hasOwn(context, name)) {
//       throw new RuntimeError(
//         RuntimeErrorCode.INACCESSIBLE_PROPERTY,
//         // EvaluationErrorCode.UNSAFE_PROPERTY,
//         `Inaccessible property name "${name}".`
//       );
//     }
//     return context[name];
//   }
//   return undefined;
// }

// export function saferGet<S, T extends Record<keyof T, S>>(
//   context: Record<keyof T, S>,
//   name: keyof T
// ): S | undefined {
//   if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name as string)) {
//     throw new RuntimeError(
//       RuntimeErrorCode.ILLEGAL_IDENTIFIER,
//       // EvaluationErrorCode.UNSAFE_PROPERTY,
//       `Illegal property name "${name as string}".`
//     );
//   }

//   if (name in {}) {
//     throw new RuntimeError(
//       RuntimeErrorCode.INACCESSIBLE_PROPERTY,
//       // EvaluationErrorCode.UNSAFE_PROPERTY,
//       `Inaccessible property name "${name as string}".`
//     );
//   }

//   if (name in context) {
//     if (!Object.hasOwn(context, name)) {
//       throw new RuntimeError(
//         RuntimeErrorCode.INACCESSIBLE_PROPERTY,
//         // EvaluationErrorCode.UNSAFE_PROPERTY,
//         `Inaccessible property name "${name as string}".`
//       );
//     }
//     return context[name];
//   }
//   return undefined;
// }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saferGet<T extends Record<keyof T, any>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<keyof T, any>,
  name: keyof T
) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name as string)) {
    throw new RuntimeError(
      RuntimeErrorCode.ILLEGAL_IDENTIFIER,
      `Illegal property name "${name as string}".`
    );
  }

  if (name in {}) {
    throw new RuntimeError(
      RuntimeErrorCode.INACCESSIBLE_PROPERTY,
      `Inaccessible property name "${name as string}".`
    );
  }

  if (name in context) {
    if (!Object.hasOwn(context, name)) {
      throw new RuntimeError(
        RuntimeErrorCode.INACCESSIBLE_PROPERTY,
        `Inaccessible property name "${name as string}".`
      );
    }
    return context[name];
  }
  return undefined;
}
