import {Tiktoken} from 'js-tiktoken';

import {Context, ErrorCode, ErrorEx, parse} from '../parser';
import {leven} from './leven';

type Inputs = 'original' | 'cannonical' | 'resolved';
type Forms = 'text' | 'tokens';

type Configuration = {
  original: Form;
  cannonical: Form;
  resolved: Form;
};

type Form = {
  text: string;
  tokens: number[];
};

export function configure(
  encoding: Tiktoken,
  text: string
):
  | {succeeded: true; config: Configuration}
  | {succeeded: false; error: ErrorEx} {
  const original = makeForm(encoding, text);
  try {
    const ast1 = parse(text);
    const cannonical = makeForm(encoding, ast1.serialize());
    const ast2 = ast1.resolve(Context.create({}, [], {}));
    // const cannonical = makeForm(encoding, ast1.node.serialize());
    // const ast2 = ast1.node.resolve(Context.create({}, [], ast1.context));
    const resolved = makeForm(encoding, ast2.serialize());
    return {succeeded: true, config: {original, cannonical, resolved}};
  } catch (e) {
    const error =
      e instanceof ErrorEx ? e : new ErrorEx(ErrorCode.INTERNAL_ERROR);
    return {succeeded: false, error};
  }
}

function makeForm(encoding: Tiktoken, text: string): Form {
  return {text, tokens: encoding.encode(text)};
}

export function select<F extends Forms>(
  config: Configuration,
  input: Inputs,
  form: F
) {
  const f = config[input][form];
  return f;
}

// let c: Configuration;
// const g = select(c, 'original', 'text');
// const h = select(c, 'original', 'tokens');

export function* forms() {
  for (const input of ['original', 'cannonical', 'resolved'] as const) {
    for (const form of ['text', 'tokens'] as const) {
      yield {input, form};
    }
  }
}

export function formatConfiguration(config: Configuration): string {
  const parts: string[] = [];
  parts.push('Original:');
  formatForm(parts, config.original);
  parts.push('Cannonical:');
  formatForm(parts, config.cannonical);
  parts.push('Resolved:');
  formatForm(parts, config.resolved);
  return parts.join('\n');
}

function formatForm(parts: string[], form: Form): void {
  parts.push('  Text:');
  parts.push('    ' + form.text);
  parts.push('  Tokens:');
  parts.push('    ' + form.tokens.join(', '));
}

// type Y<T> = {
//   sequence: T[];
//   edits: Z;
//   rouge: Z;
// };

export function compare(encoding: Tiktoken, a: string, b: string) {
  const aConfig = configure(encoding, a);
  const bConfig = configure(encoding, b);
  if (aConfig.succeeded && bConfig.succeeded) {
    const results: {
      input: Inputs;
      form: Forms;
      a: string | number[];
      b: string | number[];
      distance: number;
    }[] = [];
    for (const form of forms()) {
      const aForm = select(aConfig.config, form.input, form.form);
      const bForm = select(bConfig.config, form.input, form.form);
      const distance = editDistance(aForm, bForm);
      results.push({...form, a: aForm, b: bForm, distance});
    }
    return {aConfig, bConfig, results};
  }
  return {aConfig, bConfig, results: []};
}

function editDistance<T extends string | number[]>(a: T, b: T) {
  const aSequence = a instanceof Array ? a : a.split('');
  const bSequence = b instanceof Array ? b : b.split('');

  // TODO: why can leven() return undefined?
  return leven(aSequence, bSequence)!;
}
