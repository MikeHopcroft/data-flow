* New
  * Update top-level README.md
  * BUG? cycle detection in resolve
  * Warnings and errors stored in Program
  * Canonicalize aliases with hashes
  * Detect unresolved (orphaned) aliases.
  * Metrics
    * (text,token)x(edit,rouge)x(source vs resolved)
    * Text diff
    * Token diff
    * Text RougeL
    * Token RougeL
    * Tree diff
  * BUG? Context.eval can return undefined value for undefined ASTNode.
    * Not a bug because an undefined node field means no node.
    * What about undefined value?
  * x Approved functions list
  * x ZOD validation
  * x BUG? Memoization of resolve
  * Tree ops
    * Immer
    * x Resolve
    * Function statistics
    * Serialize + tokenize + diff
    * Compare
  * Repl demo
  * x AST resolver
  * AST walker
    * For resolving copy - traversal
    * For accumulating function call info - simple map w/dedupe
    * For comparing two plans - 
  * Analysis tools
    * Function call and slot extractor
* README.md
* YAML to JS converter
* Serialize ASTNode to source code
* Allow trailing comma in object literals
* Allow empty element in array literals (undefined)
* Define object literal property and value with ASTReference providing property name and value
* Compare
  * resolve() - looks up and replaces aliases
  * compare() - distance metric for two AST trees
    * . lodash deep compare of objects - checked with Chai's assert.deepEqual()
  * analyze() - information about functions and slots
* x Remove old lib folder and unit tests. Rename lib2.
* x Tokenizer
  * x Reuse RE from safe getter
  * x Other escape codes in strings
  * x Undefined and null
  * x /* */ comments
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
