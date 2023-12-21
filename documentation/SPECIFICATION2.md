# Plan Language Proposal

The purpose of this project is to explore ways in which a Large Language Model (LLM) can initiate a sequence of chained asynchronous calls to back-end services. The focus of this design note is a lightweight syntax for LLMs to express a computation `Plan`, based on the composition of service calls.

We describe a language whose syntax is an ***extremely limited subset of Javascript syntax***, relating mainly to the staging of function parameters, invoking functions, and reshaping return values in order to pass them to other functions. Towards the end of this design note, we also describe an [Alternative Approach](#alternative-approach), which is a hybrid between a serialization format, like YAML and JSON, and JavaScript template literals.

**Language Goals**
1. Provide a language with simple syntax and semantics that are familiar to base models trained on coding examples from widely used programming languages.
2. Ideally this langauge will be supported by existing language authoring and validation tooling and be amenable to transformation and analysis, using industry standard libraries. `Plan` analysis is important for the Data Science inner loop.
3. The language should be easy for human labelers to understand and author. It should be possible to use standard tooling for syntax highlighting, auto-completion, and schema validation.
4. The language should be easy to implement.

As mentioned above, we propose a language whose syntax is an ***extremely limited subset of Javascript syntax***. The semantics of the language differ from Javascript in two key ways: 
1. The details of asynchronous function invocation are implicit, thus releasing the LLM from the burden of specifying this behavior.
2. Alias definitions, which use the syntax of variable assignment, are interpreted as defining a data-flow dependency graph for the `Plan`. The structure of this graph determines the maximal level of concurrancy available when evaluating a `Plan`. 

This language is intended for scenarios where the LLM produces a `Plan`, which is then executed, with the results being forwarded to the next stage. The language can also be used in scenarios where the results are returned to the original LLM for further processing. For more information about this iterative scenario, see the [note pertaining to the use vs return keywords](#note-on-use-vs-return) later in this document.

## Foundational Concepts

The semantics of the data-flow language are grounded in the concepts of asynchronous function calls, synchronous function calls, and a set of alias bindings stored in an execution context.

### Asynchronous Functions
Assume that a backend service is represented by an asynchronous call to a function that takes a list of JSON serializable values as parameters and returns a Promise to another JSON serializable value.

For this discussion, we will call these functions `AsyncFunctions`. Here's the TypeScript definition for `AsyncFunction`:

~~~typescript
// JSON Serializable.
type Serializable = Obj | Primitive | Array<Serializable>;
type Obj = {[key: string]: Serializable};
type Primitive = boolean | number | string | undefined | null | Date;

type AsyncFunction<INPUT extends Serializable[], OUTPUT extends Serializable> = (
  ...params: INPUT
) => Promise<OUTPUT>;
~~~

**A note about AsyncFunction parameters:** While the above definition allows `AsyncFunctions` to accept a list of parameters, it is a *convention* with many remote procudure calls (RPCs) to define endpoints that take a single JSON serializable object parameter. This design note takes no position on the arity of `AsyncFunctions`. Choosing an appropriate number of parameters is left to the user.

**A note about Slots:** Some uses may adopt the _convention_ that the parameter is a flat property bag of named `Slots`. This design note takes no position on the shape of the parameter and the concept of `Slots`. Choosing whether to organize the parameter around `Slots` is left as a decision for the user.

### Synchronous Functions
Parameter shaping and staging may involve calls to synchronous helper functions. One example is a function that helps perform date math for a concept like "next Tuesday" relative to some datetime value.

We call these helper functions `SyncFunctions` and they differ from `AsyncFunctions` in that their return types are `Serializable`, instead of `Promise<Serialiable>`.

~~~typescript
type SyncFunction<INPUT extends Serializable[], OUTPUT extends Serializable> = (
  ...params: INPUT
) => OUTPUT;
~~~

### Context
We define an evaluation `Context` object which provides alias bindings to `AsyncFunctions`, `SyncFunctions`, and `Serializable` values.

~~~typescript
type Alias = string;

type Context = Record<Alias, 
  | AsyncFunction<Serializable[], Serializable>
  | SyncFunction<Serializable[], Serializable>
  | Serializable
>;
~~~

The `Context` provides the definitions for identifiers referenced by a `Plan`.

Note that identifiers are treated as expression aliases in a data-flow graph. Alias definitions should be thought of as `let` declarations in functional languages and not as imperative variable assignment.

The `Context` for `Plan` evaluation is the composition of an external `Context` and one or more local `Contexts`. The external `Context` provides bindings for built-int concepts like available RPC stubs, convenience functions, and constants. The local `Context` includes bindings for aliases defined within the `Plan` (more on aliases later) and bindings relative to an object (e.g. `a.b`).

In the combined `Context`, definitions from the `Plan's` local `Contexts` supercede or shadow those from the external `Context`.

## Language Concepts

### Syntax
The language syntax is a strict subset of Javascript with support for the following concepts:

* Primitive literals
  * Integer numbers, e.g. 1, -2, +3
  * Boolean literals, e.g. `true`, `false`
  * Undefined literal, e.g. `undefined`
  * Null literal, e.g. `null`
  * String literals
    * Single and double quoted strings
    * Limited escaping, e.g. \n, \t
  * Template literals, e.g. \`Hello ${name}`
* Composite literals
  * Array literals, e.g. [1, 'hello', true]
  * Object literals, e.g. { a: 1, b: 'hello' }
* Operators
  * Dot, e.g. `a.b.c`
  * Array index, e.g. `a[b]`
  * Function application, e.g. `a(b,c)`
* Alias definition, e.g. `a = 5;`
* Alias reference/substitution, e.g. `a`
* Return statement, e.g. `return 5;`
* Use statement, e.g. `use 5;`
* Comments, e.g. `/* comment */` and `// comment`

We omit other Javascript concepts that are not considered essential for the primary goal of shaping return values from one function call for use as parameters to another function call.

### Grammar

The grammar is a subset of the Javascript grammar:

~~~
PROGRAM: (ALIAS_DEC)* 'return' EXPRESSION ';'
ALIAS_DEC: IDENTIFIER = EXPRESSION ';'
EXPRESSION:
  LITERAL |
  ARRAY |
  OBJECT |
  IDENTIFIER |
  FUNCTION_CALL
LITERAL:
  NUMBER |
  BOOLEAN |
  STRING |
  TEMPLATE |
  UNDEFINED
ARRAY: '[' EXPR_LIST ']'
OBJECT: '{' (PROPERTY (',' PROPERTY)*)? '}'
FUNCTION_CALL: IDENTIFIER '(' EXPR_LIST ')'
PROPERTY: IDENTIFIER ':' EXPR
EXPR_LIST: (EXPR (',' EXPR)*)?
IDENTIFIER: [a-zA-Z][a-zA-Z0-9_]*
NUMBER: [+-]?[0-9]+
BOOLEAN: 'true' | 'false'
UNDEFINED: 'undefined'
STRING: (subset of Javascript spec - too complex to reproduce here)
TEMPLATE: (subset of Javascript spec - too complex to reproduce here)
~~~

### Semantics of Aliases
The value of a reference to an alias is the value of the expression associated with the alias. This expression is evaluated no more than once during the evaluation of a `Plan`. The result of the initial evaluation is memoized for use of by all references to the same alias. Note that an `alias` expression will only be evaluated if the `alias` is referenced by another expression that is also evaluated. The consequence here is that a `Plan` may contain orphaned alias definitions that are never evaluated.

### Semantics of Function Calls
Asynchronous call and await behavior is implicit in the semantics of function calls. 

Suppose we have a `Context` that provides access to three backend service stubs called `DomainA`, `DomainB`, and `DomainC`.

~~~typescript
type ExampleContext1 = {
  domainA: ({slot1: string}) => {field1: number};
  domainB: ({slot2: string}) => {field2: string}[];
  domainC: ({slot3: number; slot4: string}) => string;
};
~~~

With this context, evaluating a `Plan` like

~~~typescript
return domainA({slot1: 'hello'});
~~~

would be equivalent to the following Javascript code:

~~~typescript
async function plan(context: Context) {
  return await context.domainA({slot1: 'hello'});
}
~~~

While not required, it is anticipated that evaluators will leverage the data-flow graph to evaluate `Plans` with maximal concurrany.

For instance, a `Plan` like
~~~typescript
return domainC({
  slot3: domainA({slot1: 'foo'}).field1,
  slot4: domainB({slot2: 'bar'})[0].field2,
});
~~~
might result in the execution code with the following semantics:

~~~typescript
async function plan(context: ExampleContext1) {
  const promises = [
    context.domainA({slot1: 'foo'}),
    context.domainB({slot2: 'bar'}),
  ] as const;
  const [a, b] = await Promise.all(promises);
  return context.domainC({slot3: a.field1, slot4: b[0].field2});
}
~~~

Comparing the source text to the `plan()` function definition, we can see a number of details the LLM doesn't have to deal with:
* Organizing the async calls around structural dependencies to provide maximum concurrancy.
* Syntax around the async and await keywords, object destructuring notation and semantics of methods like Promises.all().

## Examples

### Aliases for Common Subexpression
There are two rationale for aliases. The first is the ability to reuse the results of common sub-expressions. Consider the following context that includes a `flightInfo` service stub that looks up details of flights and an `other` service stub that does something with date ranges:

~~~typescript
type ExampleContext2 = {
  flightInfo: Domain<
    {airline: string; flight: number},
    {departs: Date; arrives: Date; origin: string; destination: string}
  >;
  other: Domain<{start: Date; end: Date}, string>;
};
~~~

With this context we might want the LLM to be able to generate a completion that introduces an alias to store the results of the `flightInfo` invocation in order to reuse the result of `flightInfo()` in the `start` and `end` properties passed to `other()`:

~~~typescript
flight = flightInfo({airline: 'AA', flight: 1234});
return other({start: flight.departs, end: flight.arrives});
~~~

A second rational for aliases is to provide the LLM with an opportunity to document an inner monologue of smaller steps, via a sequence of alias bindings and comments.

## Aliases for SyncFunctions and Constants

The evaluation context is not limited to `AsyncFunctions` bindings. It can also provide bindings to `Serializable` values and `SyncFunctions`. These bindings can be used to provide built-in constants and convenience functions. Examples of constants include concepts like
* `now: Date` - the time to use as the current time
* `user: string` - user's alias
* `account: number` - user's account number

Here's a hypothetical example of convenience functions and constants to simplify date calculations:

~~~typescript
// Suppose type Date in not the JavaScript Date type, but something
// analogous that provides flow-style API chaining and is JSON
// serializable.
type Date = {
  at(time: Time): Date;
  plus(count: number, unit: DateMathUnits): Date;
  minus(count: number, unit: DateMathUnits): Date;
  startOf(unit: DateMathUnits): Date;
  endOf(unit: DateMathUnits): Date;
};

type DateMathUnits = 'hour' | 'day' | 'week' | 'month' | 'year';

type Weekdays =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

type DateMathConstant = DateMathUnits | Weekdays;

type DateMathContext = {
  current: (component: DateMathConstant) => Date;
  last: (component: DateMathConstant) => Date;
  next: (component: DateMathConstant) => Date;
  yesterday: Date;
  tomorrow: Date;
  now: Date;
  Sunday: 'Sunday';
  Monday: 'Monday';
  Tuesday: 'Tuesday';
  Wednesday: 'Wednesday';
  Thursday: 'Thursday';
  Friday: 'Friday';
  Saturday: 'Saturday';
  hour: 'hour',
  day: 'day',
  week: 'week';
  month: 'month';
  year: 'year';
};
~~~

With this sort of `Context`, the LLM could express date math as follows:

~~~typescript
next(Thursday).at('9:00am');
last(Tuesday).plus(23, day).at('9:00am');
~~~

**A note on date math:** There is some debate about whether LLMs can perform date math. Even if LLMs can perform date math, we may still benefit from convenience functions when deriving new dates from those returned from a service call. `SyncFunctions` are the only option for date math in scenarios that don't pass results back to the originating LLM for further processing (see [note on use vs return keywords](#note-on-use-vs-return)).

## Discussion

### Beneficial Characteristics
The language described above has the following beneficial characteristics:

* Familiar to base models trained on common programming languages.
* Simple syntax and semantics.
* Syntax and grammar have stood the test of time.
* Easy for human labelers to understand and author.
* Works with existing language service tools. Syntax highlighting, auto-completion, and type/schema validation are helpful to human labelers creating training and eval cases.
* Can be parsed and validated with existing Javascript parsers.
* Implementing a parser is easy.
* Implementing the runtime is easy.

Another beneficial characteristic is that the language syntax and semantics are orthogonal to the functionality offered by services and the object model returned by service calls. The consequences are
* New functionality can be introduced without changing the syntax and semantics of the language. All that is required is to add new bindings to the `Context`.
* The runtime can decide whether to materialize objects returned by services. The only restriction is that property getter functions are synchronous.

### Potential Drawbacks
One potential drawback to this approach, when compared with the more declarative [Alternative Approach](#alternative-approach), described below, is that it is less amenable to rudamentary analysis for Data Science purposes. One important Data Science use case is understanding the distribution of RPC calls and their parameters.

A more declarative approach, based on a standard serialization format like YAML or JSON, may allow Data Scientists to carry out this sort of analysis using off-the shelf tools. It should be noted, however, that this sort of analysis will be incomplete to the extent that the declarative plan leverages aliases and template literal expressions.

### Security and Defense in Depth
Any scenario that involves executing code generated by an LLM creates the potential for injection attacks and unintended code execution that could cause harm in an elevated context or contribute a DOS attack in any context.

With this in mind, implementations should emphasize a defense-in-depth approach. Some considerations follow:
* It would be unwise to rely on Javascript's eval function, as this exposes the entire capability of Javascript.
* Running Javascript in a sandbox is not enough. Many sandboxes have vulnerabilities and there may be cases where the values returned from the sandbox are able to cause unintended behavior inside the host environment.
* To decrease the surface area of attacks, it probably makes sense to limit parameter names used in object literals and by the dot operator to disallow special names like `__prototype__` and `toString` and anything that is not an `own` property. This is a challenging problem because it is hard to get a definative list of special properties. One might also consider basing the implementation on a dictionary type like the JavaScript Map, instead of relying on native Javascript objects. The nice thing about the dictionary is that it only contains the symbols that the evaluator stored.
* It may be beneficial to restrict functions to only reside in values bound in the `Context`. This restriction would prevent functions from being passed as parameters or stored in data structures that are returned from an evaluation.
* It may be beneficial to serialize/deserialize data structures moved across sandbox boundaries.

## Note on Use vs Return
This approach can be extended for iterative scenarios, where the result of the `Plan` evaluation is returned to the original LLM for further processing. One way to do this is to add a `use` keyword that is a counterpart to the `return` keyword.

With these two keywords, `return` would indicate that the resulted should be forwarded to the next pipeline stage. The `use` keyword would hand the results back to the original LLM for further processing.

In the iterative scenario, the LLM could decide whether to termine the loop, by generating a new plan that ends with the `return` keyword.

This decision could also be made during `Plan` execution if we extended the language with some form of conditional execution that would choose between the two cases. One could imagine a `useOrReturn` keyword that took a predicate and expressions for the `use` and `return` cases.

## Alternative Approach
This section describes an alternative approach (`Plan2`) that has some characteristics beneficial to Data Science. 

This approach is a hybrid, combining a serialization format like YAML of JSON with JavaScript template literal expressions for some values.

Here the elements of the `Plan2` data structure are analogous to nodes of the parse tree of the JavaScript `Plan`.

The main differences are
1. `Plan2` embraces the convention that `AsynFunctions`, which it calls `Domains`, take a single parameter which is a property bag of named `Slots`. Each `Slot` is an array of `TemplateLiterals` that can include Javscript expressions involving identifiers from the evaluation context.
2. Alias definitions are expressed as key-value pairs of the root object.
3. A special `result` alias indicates the return value of the `Plan2`.
4. Async function invocations are expressed as an object where each key-value pair specifies an `AsyncFunction` (or `Domain`) and its single parameter. (e.g. {flightInfo: {airline: "United" flight: 123}}). Evaluation of this object (known as a `DomainSet`) produces a new object with the same keys bound to the results of their corresponding `Domain` invocations.
5. Other expressions are provided by template literal syntax inside of string literal values. (e.g. ${next(Tuesday)}). Note that a template literal expression can also invoke an `AsyncFunction`.

Here's an example `Plan2` expressed as YAML:
~~~yaml
alias1:
  domain1:
    slot1:
      -value1
      -value2
    slot2:
      -value3
  domain2:
    slot3:
      -value4
result: hello, world ${alias1.domain1.fieldX} and ${domain2.fieldY}
~~~

Here is the type system:
~~~typescript
type Plan2 = Record<Alias, DomainSet | TemplateLiteral>;

type Alias = string;
type TemplateLiteral = string;

type DomainSet = Record<DomainName, DomainSlots>
type DomainName = string;

type DomainSlots = Record<SlotName, SlotValue>
type SlotName = string;
type SlotValue = TemplateLiteral[];
~~~

`TemplateLiterals` differ from those in JavaScript in that they aren't surrounded by backticks (\`). Any string typed as `TemplateLiteral` in the above definition will be evaluated as if it were a back-ticked JavaScript template literal, where expressions are marked by ${expression}, and evaluated according to the `EXPRESSION` production in the grammer for the original `Plan`.

`TemplateLiterals` also differ from those in JavaScript in that they can, in certain cases, generate types other than strings. If the template literal contains only an expression, with no text before or after the expression, the result will be the actual value of the expression and not its string representation, so `"${1}"` will return the number 1, while `" ${1}"` will return the string `" 1"`.

### Example
Consider the following `Plan2`:
~~~yaml
a:
  domainA:
    slot1: foo
  domainB:
    slot2: bar
result:
  domainC:
    slot3: ${a.domainA.field1}
    slot4: ${a.domainB[0].field2}
~~~

Its evaluation might result in the execution of the following code:

~~~typescript
async function plan(context: ExampleContext1) {
  const promises = [
    context.domainA({slot1: 'foo'}),
    context.domainB({slot2: 'bar'}),
  ] as const;
  const [a, b] = await Promise.all(promises);
  return context.domainC({slot3: a.field1, slot4: b[0].field2});
}
~~~

### Discussion

* The top-level alias-domain-slot hierarchy is amenable to anaysis by data scientists using off the shelf tools like a YAML parser.
* Because object literals bound to aliases define the semantics of `Domain` invocation, one must use template literal expressions to specify object literals that are not `Domain` invocations. This is why the template literal evaluator provides a mechanism for returning non-string values.
* A consequence of supporting template literals is that implementing an interpreter for `Plan2` involves implementing most of the parser and interpreter for `Plan`. The `Plan2` format mainly adds some additional structure and constraints.
* One potential drawback is that the syntax for template literals is not standard JavaScript (no backticks) and the composition of a serialization format like YAML, with the notion that all string values are actually template literals is also non-standard. This may hinder the use of standard tooling for syntax highlighting, auto-completing, and schema validaton.

## Recommendation

The current recommendation is to go with Javascript `Plan` subset, but provide some convenience functions to assist in Data Science analysis scenarios.

### Rationale

* `Plan` is a strict subset of JavaScript syntax with semantics close enough to allow support by standard tooling and parsers.
* `Plan` is more general than `Plan2` because it doesn't emphasize the structure of `Domains` of property bags of `Slots`. Note that `Plan2` has no way of enforcing this structure because a `Plan2` can always include template literal expressions.
* `Plan` requires less effort to implement than `Plan2`. The reason is that `Plan2` template literals include almost the entire functionality of `Plan` expressions.

### Support for Data Science analysis scenarios

The primary analysis scenario for Data science is generating statistics about the `Domains` referenced by a `Plan` and the `Slot` names passed to these domains.

Note that the existance of aliases and template literals makes a complete static analysis hard in either `Plan` or `Plan2`. It should be possible, however, to provide a function that would support an analysis with the same level of quality as could easily be done on `Plan2`.

One way to do this would be to provide a converter from `Plan` format to `Plan2` format. This converter would map bindings to expressions that are `AsyncFunction` calls involving object literals to the declarative `Plan2` object syntax. All other expressions would be converted to template literal expressions.
