import dedent from 'dedent';
import {createLexer, tokenNames} from '../lib';

const lexer = createLexer();
let token = lexer.parse(dedent`
  // out = flights({
  //   date: '10/10/23',
  //   airline: 'United',
  //   number: 5117
  // });
  // back = flights({
  //   date: '10/15/23',
  //   airline: 'United',
  //   number: 5030
  // });
  back = flights({});
  return car({
    location: out.destination,
    pickup: \`a\`
  });
`);
while (token) {
  console.log(`${tokenNames[token.kind]}: "${token.text}"`);
  token = token.next;
}
