import z from 'zod';

import {ASTNode, Function} from '../interfaces';

import {Context} from './context';
import {parse} from './parser';

export async function run(
  globals: Record<string, unknown>,
  types: [Function, z.ZodType][] | undefined,
  src: string
): Promise<unknown> {
  const {context, node} = await parse(src);
  const combined = Context.create(globals, types, context);
  const value = await node.eval(combined);
  return value;
}

export function resolve(src: string): ASTNode<unknown> {
  const {context, node} = parse(src);
  return node.resolve(Context.create({}, undefined, context));
}
