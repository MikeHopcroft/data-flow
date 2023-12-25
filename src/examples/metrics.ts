import {getEncoding} from 'js-tiktoken';

import {compare, formatConfiguration} from '../lib';

const encoding = getEncoding('cl100k_base');

function go() {
  const cases: {a: string; b: string}[] = [
    {a: 'return 123', b: 'return 123'},
    {a: 'return 123', b: 'return 456'},
    {a: ' a = 123;  return a', b: 'b = 123; return b'},
    {a: 'a = 123; b=a; return b', b: 'b=a; a = 123; return b'},
  ];

  for (const {a, b} of cases) {
    console.log('-------------------------------------------');
    const result = compare(encoding, a, b);
    if (result.aConfig.succeeded && result.bConfig.succeeded) {
      console.log('a:');
      console.log(formatConfiguration(1, result.aConfig.config));
      console.log('b:');
      console.log(formatConfiguration(1, result.bConfig.config));
      console.log('Distances for each input type and form:');
      for (const r of result.results) {
        console.log(`  ${r.input}-${r.form}: ${r.distance}`);
      }
      // console.log(JSON.stringify(result, null, 2));
    }
  }
}

go();
