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

  // In this example, the calls to a() and b() are made in parallel, but must
  // run to completion before c() can be called.
  const result = await run(globals, 'return c(500, a(1000, 1), b(1000, 2));');
  console.log(result);
}

go();
