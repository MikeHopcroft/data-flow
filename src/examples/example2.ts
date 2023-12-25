import {getEncoding} from 'js-tiktoken';

import {compare} from '../lib';

const encoding = getEncoding('cl100k_base');

function go() {
  const cases: {a: string; b: string}[] = [
    {a: 'return 123', b: 'return 123'},
    {a: 'return 123', b: 'return 456'},
    {a: ' a = 123;  return a', b: 'b = 123; return b'},
  ];

  for (const {a, b} of cases) {
    const result = compare(encoding, a, b);
    console.log(JSON.stringify(result, null, 2));
  }
}

go();
