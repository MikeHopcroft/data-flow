import {Context} from './context';
import {ASTNode} from './interfaces';
import {parse} from './parser';

export async function run(
  globals: Record<string, unknown>,
  src: string
): Promise<unknown> {
  const {context, node} = await parse(src);
  const combined = new Context(globals, context);
  const value = await node.eval(combined);
  return value;
}

export function resolve(src: string): ASTNode<unknown> {
  const {context, node} = parse(src);
  return node.resolve(new Context({}, context));
}
