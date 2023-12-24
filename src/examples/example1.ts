import z from 'zod';

import dedent from 'dedent';
import {Function, run} from '../lib';

async function go() {
  // We define the set of global symbols that can be referenced from
  // within an expression.
  const globals = {
    // `` represents a number.
    n: 123,

    // `a()`, `b()`, and `c()` are async functions that sleep before
    // returning.
    a: async (time: number, value: number) => {
      console.log(`a sleeps for ${time}ms...`);
      await sleep(time);
      console.log(`a returns ${value}`);
      return value;
    },
    b: async (time: number, value: number) => {
      console.log(`b sleeps for ${time + 1000}ms...`);
      await sleep(time + 1000);
      console.log(`b returns ${value}`);
      return value;
    },
    c: async (time: number, x: number, y: number) => {
      console.log(`c sleeps for ${time}ms...`);
      await sleep(time);
      const value = x + y;
      console.log(`c returns ${value}`);
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
  const types: [Function, z.ZodType][] = [
    [globals.a, z.array(z.number(), z.number())],
    [globals.b, z.array(z.number(), z.number())],
    [globals.c, z.array(z.number(), z.number())],
  ];

  // Here we pass the `globals`, `types`, and the expression to be evaluated.
  // to the `run()` function. The result is a promise that resolves to the
  // value of the expression.
  console.log(dedent`
    In this example, the calls to a() and b() are made in parallel,
    but must run to completion before c() can be called.`);
  const result1 = await run(
    globals,
    types,
    'return c(500, a(1000, 1), b(1000, n));'
  );
  console.log(result1);

  // In this example, we see that the expression evaluator does not eliminate
  // common subexpressions. The function `a()` will be called twice.
  console.log('--------------');
  console.log('In this example, a() is called twice.');
  const result2 = await run(
    globals,
    types,
    dedent`
    return c(500, a(1000, 1), a(1000, 1));
  `
  );
  console.log(result2);

  // In this example, we use `x` as an alias for the result of calling
  // `a(1000,1)`. The alias `x` is evaluated only one time.
  console.log('--------------');
  console.log('In this example, a() is called once.');
  const result3 = await run(
    globals,
    types,
    dedent`
    x = a(1000, 1)
    return c(500, x, x);
  `
  );
  console.log(result3);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

go();
