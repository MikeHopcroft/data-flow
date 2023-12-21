* . lodash deep compare of objects - checked with Chai's assert.deepEqual()
* YAML converter
* Compare
  * resolve() - looks up and replaces aliases
  * compare() - distance metric for two AST trees
  * analyze() - information about functions and slots
* Tokenizer
  * /* */ comments
  * Other escape codes in strings
  * Reuse RE from safe getter
  * x Undefined and null
  * x Scientific notation for numbers
  * x Escaped quotes in strings
  * x // comments
  * x String interpolation parts
    * x No expression
    * x One expression
    * x Multiple expressions
* Runtime type checking
  * Funtion arity matches parameter list
* x Check for cycles
* x Optional semicolons after ALIAS_DEC, RETURN, USE
* x Literals
  * x object
  * x undefined
  * x null
* x Operators
  * x dot
  * x []
* x Structure
  * x vardecs
  * x return
  * x use
* x Safe property set and duplicate key check in OBJECT literal, PROGRAM
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


~~~
> a.match(/(?:[^\$]|(?:(?!\${)\$))*/)
[ '`a $ b ', index: 0, input: '`a $ b ${c} d e`', groups: undefined ]
> a
'`a $ b ${c} d e`'
>

> a
'`a $ b ${c} d e`'
> a.match(/`(?:[^\$`]|(?:(?!\${)\$))*/)
[ '`a $ b ', index: 0, input: '`a $ b ${c} d e`', groups: undefined ]
> a.match(/`(?:[^\$`]|(?:(?!\${)\$))*\${/)
[ '`a $ b ${', index: 0, input: '`a $ b ${c} d e`', groups: undefined ]
>
~~~

https://www.npmjs.com/package/@tootallnate/quickjs-emscripten
https://www.npmjs.com/package/safe-eval
https://www.npmjs.com/package/eval
