* New
  * Security threat modelling
    * Prototype poisoning
    * toJSON()
    * x toString()
    * Running unapproved functions in the sandbox
    * Running unapproved functions in the host
    * Infinite loops
  * Don't allow assignment of unapproved functions to properties
  * Allow trailing comma in object literals
  * Allow empty element in array literals (undefined)
  * Why do ASTNodes have a position?
  * BUG?: object with one property
  * BUG? cycle detection in resolve
  * Consider pre-tokenizing alternative lexer rule (instead of retokenizing)
  * YAML to JS converter
  * . Update top-level README.md
  * Warnings and errors stored in Program
  * Canonicalize aliases with hashes
  * Detect unresolved (orphaned) aliases.
  * Metrics
    * . (text,token)x(edit,rouge)x(source vs resolved)
    * x Text diff
    * x Token diff
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
    * Reduce - constant subexpressions
    * x Immer
    * x Resolve
    * x Function statistics
    * x Serialize + tokenize + diff
    * x Compare
  * Repl demo
  * x AST resolver
  * AST walker
    * For resolving copy - traversal
    * For accumulating function call info - simple map w/dedupe
    * For comparing two plans - 
  * Analysis tools
    * Function call and slot extractor
* README.md
* x Serialize ASTNode to source code
* Define object literal property and value with ASTReference providing property name and value
* Compare
  * x resolve() - looks up and replaces aliases
  * x compare() - distance metric for two AST trees
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
* x Runtime type checking
  * x Funtion arity matches parameter list
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

https://pragmaticwebsecurity.com/articles/spasecurity/json-stringify-xss
https://dev.to/vuesomedev/the-secret-power-of-json-stringify-393b
https://stackoverflow.com/questions/63926663/how-should-untrusted-json-be-sanitized-before-using-json-parse
https://medium.com/intrinsic-blog/javascript-prototype-poisoning-vulnerabilities-in-the-wild-7bc15347c96

Investigate defining get() and toJSON() and toString()

https://github.com/minimaxir/big-list-of-naughty-strings
