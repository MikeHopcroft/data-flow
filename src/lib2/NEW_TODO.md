* Unit test tokenizer errors
  * Bad identifer name
* Tokenizer
  * Scientific notation for numbers
  * Escaped quotes in strings
  * Unefined and null
  * Resuse RE from safe getter
  * // comments
  * /* */ comments
  * String interpolation parts
    * No expression
    * One expression
    * Multiple expressions
* x Memoizing
  * x Are nodes memoized in place inside of ASTNodes?
  * x Can the same node be evaluated in two different Contexts?
  * x Can the symbol be memoized in the symbol table?
* Check for cycles
* x Structured error handling
* Literals
  * undefined
  * null
* x Arrays
* x Objects
* IEvaluationContext.get() should do SafePropertyGet
* ObjectContext
* Difference between Context and SymbolTable
  * Symbol table maps reference nodes identifiers to ASTNodes
  * Context maps identifiers to values - needs to be this way for dot, as parent context is an object, not an ASTNode.
  * Can they be the same?
* Potential problem with reference context
  * a.b.c\[global]
  * a is evaluated in top context
  * b is evaluated in Context(a)
  * c is evaluated in Context(b)
  * Which context is \[global] evaluated?