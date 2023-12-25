import z from 'zod';

import {ASTNode, Function} from '../interfaces';

import {Context} from './context';
import {parse} from './parser';

export async function run(
  globals: Record<string, unknown>,
  types: [Function, z.ZodType][] | undefined,
  src: string
): Promise<unknown> {
  const root = await parse(src);
  const context = Context.create(globals, types, {});
  const value = await root.eval(context);
  return value;
}

export function resolve(src: string): ASTNode<unknown> {
  const root = parse(src);
  return root.resolve(Context.create({}, undefined, {}));
}
