# Problem Statement

The purpose of this project is to explore ways that a Large Language Model (LLM) can initiate a sequence of chained asynchronous calls to back-end services.

**HISTORICAL NOTE:** The languaged described here is an evoluation away from an [earlier version](./SPECIFICATION.md) the relied on string interpolation. On reflection, it appears that string interpolation is not fundamental to the problem space. Rather it was a feature introduced as a side effect of choosing a syntax (e.g. custom syntax, YAML) that doesn't support expressions.

## Framing

Let's assume that a backend service is represented by an asynchronous call to a function that takes a single JSON serializable object and returns a Promise to another JSON serializable object.

For this discussion, we will call these backend services `Domains`. Here's the TypeScript definition for `Domain`:


~~~typescript
// JSON Serializable.
type Serializable = Obj | Primitive | Array<Serializable> | undefined;
type Obj = {[key: string]: Serializable};
type Primitive = boolean | number | string | undefined | null | Date;

type Domain<INPUT extends Serializable, OUTPUT extends Serializable> = (
  param: INPUT
) => Promise<OUTPUT>;
~~~

Let's also assume that we have available a `Context` object that provides bindings to each of the available `Domains`. Here is an example:

~~~typescript
type Context = Record<string, Domain<any, any> | Serializable>;

// ExampleContext1 is a Context that provides bindings to three Domains.
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

## Aliases

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

A second rational for aliases is to provide the LLM with an opportunity to document an inner monologue of smaller steps, via a sequence of variable bindings and comments.

## Bindings to Serializable in Context

The evaluation context is not limited to `Domain` bindings. It can also provide bindings to `Serializable` values. These bindings can be used to provide built-in constants and convenience functions. Examples of constants include concepts like
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

## Modularity
An important characteristic of the `Context` is that it allows use to add capabilities to the system without having to change the parser or evaluator.

Many new capabilities, such as new `Domains`, and the date math functions shown above, can be added with bindings in the `Context`.

## Discussion

The language the LLM outputs is, syntactically speaking, a strict subset of Javascript, but its type system and evaluation semantics are different. 

### Syntactic subset

The functionality is the subset of Javascript needed to compose `Serializable` values from other `Serializable` objects, arrays and primitives and to extract data from `Serializable` values.

It also includes the syntax to invoke built-in local and `Domain` functions.

Included:
* primitive literals for string, number, boolean, null, undefined
* object literals
* array literals
* dot operator
* array index operator
* function invocation
* comments

Excluded:
* All other syntactic elements including
* string interpolation
* function, arrow function, and class definitions
* async and await keywords
* operators with the execption of dot
* destructuring

### Semantic differences

While the code is syntactically a restricted subset of Javascript, the semantics differ in a few important ways:
* Alia dexclarations are bindings, not variable assignment. An alias declaration does not side-effect the context. Instead it produces a new context that is the combination of the old context and the new binding.
* Execution plan uses dependency analysis to dispatch async calls with maximum concurrancy.
* Function calls to domains are implicitly async.
* Function calls to built-in convenience functions are implicitly synchronous.
* Code is evaluated in a runtime context that has type Context.
* Function calls cannot side-effect the Context.

### Safety considerations

We would like the design to minimize the risk of injection attacks and running arbitray code in privileged contexts. We would also like to use defense-in-depth and therefore avoid implementations that run a full Javascript evaluator in a sandbox environment that could have undiscovered vulnerabilities.

## Questions

* This language looks like Javascript, but its semantics differ in fundamental ways. Is there any way we could preserve the Javascript semantics, while retaining the concise LLM output format?
* Do the benefits of using a non-standard language outweigh the costs?
  * Benefits
    * LLM doesn't have to reason about async, await, and execution order. Semantics is declarative.
    * Token count may be lower, reducing latency in LLMs used as middleware.
    * Potential to make a more relaxed parser that can recover from small syntactic errors that would break a more rigid parser (e.g. trailing commas in JSON)
  * Costs
    * Implementing and maintaining parser and evaluator.
    * Any situations where standard tooling becomes unavailable (e.g. intellisense, auto-complete in VS code)
    * Complexity for humans and LLMs due to differences in semantics that are not immediately apparant in the syntax.
