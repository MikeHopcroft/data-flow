import {ASTNodeBase} from './interfaces';

export class CycleDetectedError extends Error {
  path: ASTNodeBase[];
  symbol: string;
  constructor(path: ASTNodeBase[], symbol: string) {
    super('Cycle detected');
    this.path = path;
    this.symbol = symbol;
  }
}

// TODO: better error message based on actual types.
export class TypeError extends Error {
  constructor() {
    super('Type mismatch');
  }
}

export class RuntimeTypeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class SkillError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class SymbolError extends Error {
  constructor(message: string) {
    super(message);
  }
}
