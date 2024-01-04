import z from 'zod';

import dedent from 'dedent';
import {Function, run} from '../lib';

// This example demonstrates API poisoning where the evaluator returns an object
// that binds the toJSON property to a function from the global context. This
// function could then be unwittingly called by JSON.stringify() in the host.

async function go() {
  // We define the set of global symbols that can be referenced from
  // within an expression.
  const globals = {
    a: async () => {
      console.log('Function a() called.');
      const value = 123;
      console.log(`a returns ${value}\n`);
      return value;
    },
  };

  // To enhance safety, we must provide zod type definitions for each
  // function that may be called from within an expresion. This serves
  // two purposes:
  //   1. Functions not listed here are considered blocked can cannot
  //      be called from within an expression. This reduces the opportunities
  //      for calling arbitrary functions. Note that this behavior can
  //      be suppressed by passing {allowUnapprovedFunctions: true} to
  //      Context.create(). Note that in some cases you may have to list
  //      a function that is not included in the global symbols. An example
  //      use case is there a function call returns an anonymous function.
  //   2. Parameters will by type checked at runtime using the provided
  //      zod validator. To allow any parameters, use z.any().
  const types: [Function, z.ZodType][] = [[globals.a, z.tuple([])]];

  // Here we pass the `globals`, `types`, and the expression to be evaluated.
  // to the `run()` function. The result is a promise that resolves to the
  // value of the expression.
  console.log(dedent`
    In this example, the return value is an object that binds its toJSON property
    to the global function \`a\`. We can display this object using console.log():
  `);
  const result1 = await run(globals, types, 'return {toJSON: a}');
  console.log(result1);

  console.log();
  console.log(dedent`
    When we call JSON.stringify() on the object, the function \`a\` is invokved.`);
  JSON.stringify(result1);

  console.log(dedent`
    We don't see a similar problem with toString() because saferGet() is able to
    block writing to this property.
  `);
  try {
    await run(globals, types, 'return {toString: a}');
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log((e as any)?.message || 'unknown error');
  }
}

go();
