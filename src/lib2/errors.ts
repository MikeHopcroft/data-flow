// import {ASTNodeBase} from './interfaces';

export enum ErrorCode {
  // Lexical errors
  // Parse errors
  // Runtime errors
  CYCLE_DETECTED,
  DUPLICATE_KEY,
  ILLEGAL_IDENTIFIER,
  INACCESSIBLE_PROPERTY,
  EXPECTED_ARRAY,
  EXPECTED_ARRAY_INDEX,
  EXPECTED_FUNCTION,
  EXPECTED_OBJECT,
  UNKNOWN_IDENTIFIER,
}

const errorCodeToString = new Map([
  // Lexical errors
  // Parse errors
  // Runtime errors
  [ErrorCode.CYCLE_DETECTED, 'Cycle detected'],
  [ErrorCode.DUPLICATE_KEY, 'Duplicate key'],
  [ErrorCode.ILLEGAL_IDENTIFIER, 'Illegal identifier'],
  [ErrorCode.INACCESSIBLE_PROPERTY, 'Inaccessible property'],
  [ErrorCode.EXPECTED_ARRAY, 'Expected an array'],
  [ErrorCode.EXPECTED_ARRAY_INDEX, 'Expected an array index'],
  [ErrorCode.EXPECTED_FUNCTION, 'Expected a function'],
  [ErrorCode.EXPECTED_OBJECT, 'Expected an object'],
  [ErrorCode.UNKNOWN_IDENTIFIER, 'Unknown identifier'],
]);

export class ErrorEx extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message || errorCodeToString.get(code) || 'Unknown error');
    this.code = code;
  }
}

// export class CycleDetectedError extends Error {
//   path: ASTNodeBase[];
//   symbol: string;
//   constructor(path: ASTNodeBase[], symbol: string) {
//     super('Cycle detected');
//     this.path = path;
//     this.symbol = symbol;
//   }
// }

// // TODO: better error message based on actual types.
// export class TypeError extends Error {
//   constructor() {
//     super('Type mismatch');
//   }
// }

// export class RuntimeTypeError extends Error {
//   constructor(message: string) {
//     super(message);
//   }
// }

// export class SkillError extends Error {
//   constructor(message: string) {
//     super(message);
//   }
// }

// export class SymbolError extends Error {
//   constructor(message: string) {
//     super(message);
//   }
// }
