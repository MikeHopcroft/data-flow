* Safe property set in object literal
* Check for cycles
* Literals
  * x object
  * undefined
  * null
* Operators
  * x dot
  * x []
* lodash deep compare of objects
* Structure
  * vardecs
  * return
  * use
* Tokenizer
  * Scientific notation for numbers
  * x Escaped quotes in strings
  * Other escape codes in strings
  * Unefined and null
  * Reuse RE from safe getter
  * x // comments
  * /* */ comments
  * String interpolation parts
    * No expression
    * One expression
    * Multiple expressions
* Compare
  * resolve() - looks up and replaces aliases
  * compare() - distance metric for two AST trees
  * analyze() - information about functions and slots
* x Memoizing
  * x Are nodes memoized in place inside of ASTNodes?
  * x Can the same node be evaluated in two different Contexts?
  * x Can the symbol be memoized in the symbol table?
* x Structured error handling
* x Arrays
* x Objects
* x Unit test tokenizer errors
  * x Bad identifer name
* x IEvaluationContext.get() should do SafePropertyGet
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