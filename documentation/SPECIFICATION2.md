# Problem Statement

The purpose of this project is to explore ways in which a Large Language Model (LLM) can initiate a sequence of chained asynchronous calls to back-end services. The focus of this design note is a lightweight syntax for LLMs to express a computation plan, based on the composition of service calls.

The intention is to provide a language with simple syntax and semantics that are familiar to base models trained on coding examples from widely used programming languages.

Ideally this langauge will be supported by existing language authoring and validation tooling and be amenable to transformation and analysis, using industry standard libraries.

This proposal describes a language whose syntax is an extremely limited subset of Javascript syntax, relating mainly to staging function parameters, invoking functions, and reshaping return values in order to pass them to other functions.

The semantics of the language differ from Javascript in two key ways: 
1. The details of asynchronous function invocation are implicit, thus releasing the LLM from the burden of specifying this behavior.
2. Alias definitions, which use the syntax of variable assignment, are interpreted as defining a dataflow dependency graph for the `Plan`. The structure of this graph determines the maximal level of concurrancy availalble when evaluating a `Plan`. 

This language is intended for scenarios where the LLM produces a `Plan`, the `Plan` is executed, and the results are forwarded to the next stage. With that said, the language can also be used in scenarios where the results are returned to the original LLM for further processing. For more information about this iterative scenario, see the note pertaing to `use` vs `return` at the end of this document.

## Foundational Concepts

The semantics of the `data-flow` language are grounded in the concepts of asynchronous function calls, synchronous function calls, and a set of alias bindings stored in an execution context.

### Asynchronous Functions
Assume that a backend service is represented by an asynchronous call to a function that takes a list of JSON serializable values as parameters and returns a Promise to another JSON serializable value.

For this discussion, we will call functions `AsyncFunctions`. Here's the TypeScript definition for `AsyncFunction`:

~~~typescript
// JSON Serializable.
type Serializable = Obj | Primitive | Array<Serializable> | undefined;
type Obj = {[key: string]: Serializable};
type Primitive = boolean | number | string | undefined | null | Date;

type AsyncFunction<INPUT extends Serializable[], OUTPUT extends Serializable> = (
  ...params: INPUT
) => Promise<OUTPUT>;
~~~

**A note about AsyncFunction parameters:** While the above definition allows `AsyncFunctions` to accept a list of parameters, it is a convention with many remote procudure calls (RPCs) to define endpoints that take a single JSON serializable object parameter. This design takes no position on the arity of `AsyncFunctions` functions. Choosing an appropriate number of parameters is left to the user.

**A note about Slots:** Some uses may adopt the _convention_ that the parameter is a flat property bag of named `Slots`. It is important to note that this design takes no position on the shape of the parameter and the concept of `Slots`. Choosing whether to organize the parameter around `Slots` is left s a decision for the users.

### Synchronous Functions
Parameter shaping and staging may involve calls to synchronous helper functions. One example is a function that helps perform date math for a concept like "next Tuesday" relative to some datetime value.

We call these helper functions `SyncFunctions` and they differ from `AsyncFunctions` in that their return types are `Serializable`, instead of `Promise<Serialiable>`.

~~~typescript
type SyncFunction<INPUT extends Serializable[], OUTPUT extends Serializable> = (
  ...params: INPUT
) => OUTPUT;
~~~

### Context
We define the an evaluation `Context` object which provides alias bindings to `AsyncFunctions`, `SyncFunctions`, and `Serializable` values.

~~~typescript
type Alias = string;

type Context = Record<Alias, 
  | AsyncFunction<Serializable[], Serializable>
  | SyncFunction<Serializable[], Serializable>
  | Serializable
>;
~~~

The `Context` provides the definitions for identifiers in a `Plan`.

Note that identifiers are treated as expression aliases in a data-flow graph. Alias definitions should be thought of as `let` declarations in functional languages and not as imperative variable assignment.

The `Context` for `Plan` evaluation is the composition of an external `Context` and a local `Context`. The external `Context` provides bindings for built-int concepts like available RPC stubs, convenience functions, and constants. The local `Context` includes bindings for aliases defined within the `Plan` (more on aliases later).

In the combined `Context`, definitions from the `Plan` `Context` supercede or shadow those from the external `Context`.

## Language Concepts

### Syntax
The language syntax is a strict subset of Javascript with support for the following concepts:

* Primitive literals
  * Integer numbers, e.g. 1, -2, +3
  * Boolean literals, e.g. true, false
  * Undefined literal, e.g. undefined
  * String literals
    * Single and double quotes
    * Limited escaping, e.g. \n, \t
  * Template literals, e.g. \`Hello ${name}`
* Composite literals
  * Array literals, e.g. [1, 'hello', true]
  * Object literals, e.g. { a: 1, b: 'hello' }
* Operators
  * Dot, e.g. a.b.c
  * Array index, e.g. a[b]
  * Function application, e.g. a(b,c)
* Alias definition, e.g. a = 5;
* Alias reference/substitution, e.g. return a;
* Return statement, e.g. return 5;

We omit other Javascript concepts that are not considered essential for the primary goal of shaping return values from one function call for use as parameters to another function call.

### Grammar

~~~
PROGRAM: (ALIAS_DEC)* 'return' EXPRESSION ';'
ALIAS_DEC: IDENTIFIER = EXPRESSION ';'
EXPRESSION:
  LITERAL |
  ARRAY |
  OBJECT |
  FUNCTION_CALL
LITERAL:
  NUMBER |
  BOOLEAN |
  STRING |
  TEMPLATE
ARRAY: '[' EXPR_LIST ']'
OBJECT: '{' (PROPERTY (',' PROPERTY)*)? '}'
FUNCTION_CALL: IDENTIFIER '(' EXPR_LIST ')'
PROPERTY: IDENTIFIER ':' EXPR
EXPR_LIST: (EXPR (',' EXPR)*)?
IDENTIFIER: [a-zA-Z][a-zA-Z0-9_]*
NUMBER: [+-]?[0-9]+
BOOLEAN: 'true' | 'false'
STRING: (subset of Javascript spec - too complex to reproduce here)
TEMPLATE: (subset of Javascript spec - too complex to reproduce here)
~~~

### Semantics of Aliases
The value of a reference to an alias is the value of the expression associated with the alias. This expression is evaluated no more than once during the evaluation of a `Plan`. The result of the initial evaluation is memoized for use of by all references to the same alias. Note that an `alias` expression will only be evaluated if the `alias` is referenced by another expression that is also evaluated. The consequence here is that a `Plan` may contain alias definitions that are never evaluated.

### Semantics of Function Calls
Asynchronous call and await behavior is implicit in the semantics of function calls. 

Suppose we have a `Context` that provides access to three backend service stubs called `DomainA`, `DomainB`, and `DomainC`.

~~~typescript
type ExampleContext1 = {
  domainA: Domain<{slot1: string}, {field1: number}>;
  domainB: Domain<{slot2: string}, {field2: string}[]>;
  domainC: Domain<{slot3: number; slot4: string}, string>;
};
~~~

With this context, valuating a `Plan` like

~~~typescript
return domainA('hello');
~~~

would be equivalent to the following Javascript code:

~~~typescript
async function plan(context: Context) {
  return await context.domainA('hello');
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
might result in the execution of the following code:

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

## Examples

### Aliases for Common Subexpression
There are two rationale for aliases. The first is the ability to reuse the results of common sub-expressions. Consider the following context that includes a `flightInfo` domain that looks up details of flights and an `other` domain that does something with date ranges:

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

## Discussion

### Beneficial Characteristics
The language described above has the following beneficial characteristics:

* Familiar to base models trained on common programming languages.
* Simple syntax and semantics.
* Syntax and grammar have stood the test of time.
* Works with existing language services tools. Syntax highlighting, auto-completion, and type/schema validation are helpful to human labelers creating training and eval cases.
* Can be parsed with existing Javascript parsers.
* Implementing a parser is easy.
* Implementing the runtime is easy.

### Potential Drawbacks
One potential drawback to this approach, when compared with the more declarative approach, described below, is that it is less amenable to rudamentary analysis for Data Science purposes. One imporatnt Data Science use cases is understanding the distribution of RPC calls and their parameters.

A more declarative approach, based on a standard serialization format like YAML or JSON allows Data Scientists to carry out this sort of analysis using off-the shelf tools. It should be noted, however, that this analysis will be incomplete to the extend that the declarative plan leverages aliases and interpolation expressions.

### Security and Defense in Depth
Any scenario that involves code generated by an LLM creates the potential for injection attacks and unintended code execution that could cause harm in elevated context or contribute a DOS attack in any context.

With this in mind, implementations should consider a defense-in-depth approach. Some considerations follow:
* It would be unwise to rely on Javascript's eval function, as this exposes the entire capability of Javascript.
* Running Javascript in a sandbox is not enough. Many sandboxes have vulnerabilities and there may be cases where the values returned from the sandbox are able to cause unintended behavior in the host environment.
* To decrease the surface area of attacks, it probably makes sense to limit parameter names used in object literals and by the dot operator to disallow special names like `__prototype__` and `toString` and anything that is not an `own` property. This is a challenging problem because it is hard to get a definative list of special properties. One might also consider basing the implementation on dictionary types like the JavaScript Map, instead of relying on objects. The nice thing about the dictionary is that it only contains the symbols that the evaluator stored.

## Note on Use vs Return
This approach can be extended for iterative scenarios, where the result of the `Plan` evaluation is returned to the original LLM for further processing. One way to do this is to add a `use` keyword that is a counterpart to the `return` keyword.

With these two keywords, `return` would mean to forward the results to the next pipeline stage. The `use` keyword would mean to hand the results back to the original LLM for further processing.

In the iterative scenario, the LLM could decide whether to termine the loop, by generating a plan that ends with the `return` keyword.

This decision could also be made during `Plan` execution if we extended the language with some form of conditional execution that would choose between the two cases. One could imagine a `useOrReturn` keyword that took a predicate and expressions for the `use` and `return` cases.

## Support for Analysis

## Support for Language Services

## Alternative Implementation

---

# Break
### An Example

Suppose we have a `Context` that provides acce3ss to three backend service stubs called `DomainA`, `DomainB`, and `DomainC`.

~~~typescript
type ExampleContext1 = {
  domainA: Domain<{slot1: string}, {field1: number}>;
  domainB: Domain<{slot2: string}, {field2: string}[]>;
  domainC: Domain<{slot3: number; slot4: string}, string>;
};
~~~

Ideally we'd like simple shorthand so that an LLM response like
~~~typescript
return domainC({
  slot3: domainA({slot1: 'foo'}).field1,
  slot4: domainB({slot2: 'bar'})[0].field2,
});
~~~

would result in the execution of code with the following semantics:

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

Comparing the LLM response to the `plan()` function definition, we can see a number of details the LLM doesn't have to deal with:
* Organizing the async calls around structural dependencies to provide maximum concurrancy.
* Syntax around the async and await keywords, object destructuring notation and semantics of methods like Promises.all().

## Terminology
This section introduces the terminology of the problem space and then defines the componts that make up a proposed solution.

Problem space terminology includes the _Plan, Domains,_ and _Slots_.

Sol

_Asynchronous Functions, Synchronous Functions, Slots, Evaluation Contexts, Aliases, Constants_, _Local Functions_, and _Plans_. The following section will combine these concepts into two syntax proposals.

### Domain Functions
Assume that a backend service is represented by an asynchronous call to a function that takes a list of JSON serializable values as parameters and returns a Promise to another JSON serializable value.

For this discussion, we will call these backend services `Domains`. Here's the TypeScript definition for `Domain`:

~~~typescript
// JSON Serializable.
type Serializable = Obj | Primitive | Array<Serializable> | undefined;
type Obj = {[key: string]: Serializable};
type Primitive = boolean | number | string | undefined | null | Date;

type Domain<INPUT extends Serializable[], OUTPUT extends Serializable> = (
  ...params: INPUT
) => Promise<OUTPUT>;
~~~

### A note about Parameters
While the above definition allows `Domain` functions to accept a list of parameters, it is a convention with many remote procudure calls (RPCs) to define `Domains` as taking a single JSON serializable object parameter. This design takes no position on the arity of `Domain` functions. Choosing an appropriate number of parameters is left to the user.

### A note about Slots
Some uses may adopt the _convention_ that the parameter is a flat property bag of named `Slots`. It is important to note that this design takes no position on the shape of the parameter and the concept of `Slots`. Whether to organize the parameter around `Slots` is left s a decision for the users.

### Local Functions

### Context
Assume that we also have available a `Context` object that provides bindings to each of the available `Domains`. Here is an example:

~~~typescript
type Context = Record<string, Domain<any, any> | Serializable | LocalFunction>;

// ExampleContext1 is a Context that provides bindings to three Domains.
type ExampleContext1 = {
  domainA: Domain<{slot1: string}, {field1: number}>;
  domainB: Domain<{slot2: string}, {field2: string}[]>;
  domainC: Domain<{slot3: number; slot4: string}, string>;
};
~~~

Note that the `Context` is also capable of maintaining bindings to `Serializable` values, in addition to `Domain` functions.

### LLM Shorthand

Ideally we'd like simple shorthand so that an LLM response like
~~~typescript
return domainC({
  slot3: domainA({slot1: 'foo'}).field1,
  slot4: domainB({slot2: 'bar'})[0].field2,
});
~~~

would result in the execution of code with the following semantics:

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

Comparing the LLM response to the `plan()` function definition, we can see a number of details the LLM doesn't have to deal with:
* Organizing the async calls around structural dependencies to provide maximum concurrancy.
* Syntax around the async and await keywords, object destructuring notation and semantics of methods like Promises.all().

### Alias bindings in the Context

We introduce the notion of symbolic aliases bound to expressions. There are two rationale for aliases. The first is the ability to reuse the results of common sub-expressions. Consider the following context that includes a `flightInfo` domain that looks up details of flights and an `other` domain that does something with date ranges:

~~~typescript
type ExampleContext2 = {
  flightInfo: Domain<
    {airline: string; flight: number},
    {departs: Date; arrives: Date; origin: string; destination: string}
  >;
  other: Domain<{start: Date; end: Date}, string>;
};
~~~

With this context we would want the LLM to be able to generate a completion that introduces an alias to store the results of the `flightInfo` invocation in order to reuse the result of `flightInfo()` in the `start` and `end` properties passed to `other()`.

~~~typescript
flight = flightInfo({airline: 'AA', flight: 1234});
return other({start: flight.departs, end: flight.arrives});
~~~

A second rational for aliases is to provide the LLM with an opportunity to document an inner monologue of smaller steps, via a sequence of alias bindings and comments.

## Other Bindings in the Context

The evaluation context is not limited to `Domain` bindings. It can also provide bindings to `Serializable` values and local `functions`. These bindings can be used to provide built-in constants and convenience functions. Examples of constants include concepts like
* `now: Date` - the time to use as the current time
* `user: string` - user's alias
* `account: number` - user's account number

Here's an example of convenience functions and constants to simplify date calculations:

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
