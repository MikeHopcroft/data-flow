# Simple Example

This sample shows how to configure the expression evaluator to call external async functions `a()`, `b()`, and `c()`. The source code is in [simple.ts](simple.ts).

## Step 1 - define global symbols
We define the set of global symbols that can be referenced from within an expression.

~~~typescript
  const globals = {
    // `n` represents a number.
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
~~~

## Step 2 - provide schemas for function parameters
To enhance safety, we must provide zod type definitions for each
function that may be called from within an expresion. This serves
two purposes:

  1. Functions not listed here are considered blocked can cannot
     be called from within an expression. This reduces the opportunities for calling arbitrary functions. Note that this behavior can be suppressed by passing `allowUnapprovedFunctions: true}` to `Context.create().` Note that in some cases you may have to list a function that is not included in the global symbols. An example use case is there a function call returns an anonymous function.
  2. Parameters will by type checked at runtime using the provided
     zod validator. To allow any parameters, use `z.any()`.

~~~typescript
  const types: [Function, z.ZodType][] = [
    [globals.a, z.array(z.number(), z.number())],
    [globals.b, z.array(z.number(), z.number())],
    [globals.c, z.array(z.number(), z.number())],
  ];
~~~

## Step 3 - Parse and evaluate an expression

~~~typescript
  const result1 = await run(
    globals,
    types,
    'return c(500, a(1000, 1), b(1000, n));'
  );
~~~

## Output

Here is the output from a sample run:

~~~
$node build/src/examples/simple.js   
In this example, the calls to a() and b() are made in parallel,
but must run to completion before c() can be called.
a sleeps for 1000ms...
b sleeps for 2000ms...
a returns 1
b returns 123
c sleeps for 500ms...
c returns 124
124
--------------
In this example, a() is called twice.
a sleeps for 1000ms...
a sleeps for 1000ms...
a returns 1
a returns 1
c sleeps for 500ms...
c returns 2
2
--------------
In this example, a() is called once.
a sleeps for 1000ms...
a returns 1
c sleeps for 500ms...
c returns 2
2
~~~
