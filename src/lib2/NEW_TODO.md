* Structured error handling
* Literals
  * undefined
  * null
* Arrays
* Objects
* Check for cycles
* Memoizing
  * Are nodes memoized in place inside of ASTNodes?
  * Can the same node be evaluated in two different Contexts?
  * Can the symbol be memoized in the symbol table?
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