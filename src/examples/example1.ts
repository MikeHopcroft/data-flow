import dedent from 'dedent';
import {run} from '../lib';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function go() {
  const globals = {
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

  console.log(dedent`
    In this example, the calls to a() and b() are made in parallel,
    but must run to completion before c() can be called.`);
  const result1 = await run(globals, 'return c(500, a(1000, 1), b(1000, 2));');
  console.log(result1);

  console.log('--------------');
  console.log('In this example, a() is called twice.');
  const result2 = await run(
    globals,
    dedent`
    return c(500, a(1000, 1), a(1000, 1));
  `
  );
  console.log(result2);

  console.log('--------------');
  console.log('In this example, a() is called once.');
  const result3 = await run(
    globals,
    dedent`
    x = a(1000, 1)
    return c(500, x, x);
  `
  );
  console.log(result3);
}

go();
