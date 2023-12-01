export enum NodeType {
  CONCATENATION,
  DOT,
  FUNCTION,
  IDENTIFIER,
  NUMBER,
  STRING,
}

export type ExpressionNode =
  | DotNode
  | FunctionNode
  | IdentifierNode
  | NumberNode
  | StringNode;

export type ConcatenationNode = {
  type: NodeType.CONCATENATION;
  children: (StringNode | ExpressionNode)[];
};

export type DotNode = {
  type: NodeType.DOT;
  parent: ExpressionNode;
  child: IdentifierNode;
};

export type FunctionNode = {
  type: NodeType.FUNCTION;
  func: ExpressionNode;
  params: ExpressionNode[];
};

export type IdentifierNode = {
  type: NodeType.IDENTIFIER;
  name: string;
};

export type NumberNode = {
  type: NodeType.NUMBER;
  value: number;
};

export type StringNode = {
  type: NodeType.STRING;
  value: string;
};

export type Primitive = boolean | number | string;
// TODO: write type for Function.
// export type Function = (...args: Value[]) => Value;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Function = (...args: any[]) => Value;
export type Value = Obj | Primitive | Function;
export type Obj = {[key: string]: Value};

export enum EvaluationErrorCode {
  EXPECTED_FUNCTION,
  LEFT_SIDE_DOT_NOT_OBJECT,
  UNKNOWN_IDENTIFIER,
  UNSAFE_PROPERTY,
}

export class EvaluationError extends Error {
  code: EvaluationErrorCode;

  constructor(code: EvaluationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function evaluate(context: Obj, node: ConcatenationNode): string {
  return node.children
    .map(c =>
      c.type === NodeType.STRING
        ? c.value
        : evaluateExpression(context, c).toString()
    )
    .join('');
}

// Exported for unit testing.
export function evaluateExpression(context: Obj, node: ExpressionNode): Value {
  switch (node.type) {
    case NodeType.DOT: {
      const parent = evaluateExpression(context, node.parent);
      if (typeof parent !== 'object') {
        throw new EvaluationError(
          EvaluationErrorCode.LEFT_SIDE_DOT_NOT_OBJECT,
          'Left side of dot expression must be an object.'
        );
      } else {
        return evaluateExpression(parent, node.child);
      }
    }
    case NodeType.FUNCTION: {
      const func = evaluateExpression(context, node.func);
      if (typeof func !== 'function') {
        throw new EvaluationError(
          EvaluationErrorCode.EXPECTED_FUNCTION,
          'Expected function.'
        );
      }
      const params = node.params.map(p => evaluateExpression(context, p));
      return func(...params);
    }
    case NodeType.IDENTIFIER: {
      if (!(node.name in context)) {
        throw new EvaluationError(
          EvaluationErrorCode.UNKNOWN_IDENTIFIER,
          `Unknown identifier ${node.name}`
        );
      }
      return safeDot(context, node.name);
    }
    case NodeType.NUMBER:
    case NodeType.STRING:
      return node.value;
    default:
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `Internal error: unknown node type ${(node as any).type}`
      );
  }
}

// The goal here is to prevent injection attacks from accessing fields other
// than those intended. This includes fields like __proto__ and toString.
function safeDot(context: Obj, name: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    throw new EvaluationError(
      EvaluationErrorCode.UNSAFE_PROPERTY,
      `Illegal property name "${name}."`
    );
  }
  if (!Object.hasOwn(context, name)) {
    throw new EvaluationError(
      EvaluationErrorCode.UNSAFE_PROPERTY,
      `Inaccessible property name "${name}."`
    );
  }
  return context[name];
}

// Generate the list of identifiers referenced that are node included
// in the `exclude` context. The expected use case is that the evaluation
// context will be the union of a set of plan-defined aliases and
// a set of built-in values. When analyzing for the purpose of generating
// a list of referenced aliases, pass the built-in symbols in the `exclude`
// context.
export function analyze(exclude: Obj, node: ConcatenationNode): string[] {
  const dependencies = new Set<string>();
  for (const child of node.children) {
    if (child.type !== NodeType.STRING) {
      analyzeExpression(dependencies, exclude, child);
    }
  }
  return [...dependencies.values()];
}

function analyzeExpression(
  dependencies: Set<string>,
  exclude: Obj,
  node: ExpressionNode
): void {
  switch (node.type) {
    case NodeType.DOT:
      // Follow left path. Ignore right.
      analyzeExpression(dependencies, exclude, node.parent);
      break;
    case NodeType.FUNCTION: {
      analyzeExpression(dependencies, exclude, node.func);
      for (const param of node.params) {
        analyzeExpression(dependencies, exclude, param);
      }
      break;
    }
    case NodeType.IDENTIFIER:
      if (!safeDot(exclude, node.name)) {
        dependencies.add(node.name);
      }
      break;
    case NodeType.NUMBER:
    case NodeType.STRING:
    default:
      break;
  }
}
