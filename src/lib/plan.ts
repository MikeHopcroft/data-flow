import {evaluate, Obj, parse} from '.';

export type Plan = Record<string, Domain>;
export type Domain = Record<string, SlotValue>;
export type SlotValue = string[];

export function evaluatePlan(context: Obj, plan: Plan): Plan {
  const result: Plan = {};
  for (const key in plan) {
    result[key] = evaluateDomain(context, plan[key]);
  }

  return result;
}

function evaluateDomain(context: Obj, domain: Domain): Domain {
  const result: Domain = {};
  for (const key in domain) {
    result[key] = evaluateSlotArray(context, domain[key]);
  }

  return result;
}

function evaluateSlotArray(context: Obj, slot: SlotValue): SlotValue {
  return slot.map(s => evaluateString(context, s));
}

function evaluateString(context: Obj, text: string): string {
  const expression = parse(text);
  return evaluate(context, expression);
}
