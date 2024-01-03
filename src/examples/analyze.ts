import dedent from 'dedent';
import {ASTFunction, ASTNode, ASTObject, ASTReference, parse} from '../lib';

function go() {
  const cases: string[] = [
    dedent`
    out = flights({
      date: '10/10/23',
      airline: 'United',
      number: 5117
    });
    back = flights({
      date: '10/15/23',
      airline: 'United',
      number: 5030
    });
    // back = flights({});
    return car({
      location: out.destination,
      pickup: \`10/10/23 \${out.arrives}\`,
      dropoff: back.departs.minus(1)
      // dropoff: \`10/10/23 \${back.departs.minus(1)}\`
    });
  `,
    // dedent`    return car({
    //   location: out.destination,
    //   pickup: \`a\`
    // });`,
  ];

  /*
      pickup: \`10/10/23 \${out.arrives}\`,
      dropoff: \`10/10/23 \${return.departs.minus(1, hour)}\`
  */

  for (const src of cases) {
    console.log('-------------------------------------------');
    const root = parse(src);
    const calls: {name: string; slots: string[]}[] = [];
    const visitor = (node: ASTNode<unknown>) => {
      if (node instanceof ASTFunction) {
        if (node.func instanceof ASTReference) {
          const name = node.func.name;
          const slots: string[] = [];
          for (const p of node.params as unknown as ASTNode<unknown>[]) {
            if (p instanceof ASTObject) {
              for (const key of Object.getOwnPropertyNames(p.value)) {
                slots.push(key);
              }
            }
          }
          calls.push({name, slots});
        }
      }
    };
    root.visit(visitor);
    console.log(calls);
  }
}

go();
