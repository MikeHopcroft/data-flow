# Problem Statement

The purpose of this project is to explore ways that a Large Language Model (LLM) can initiate a sequence of chained asynchronous calls to back-end services. The focus of this design note is a lightweight syntax for LLMs to express a computation _Plan_, based on the composition of service calls. 

## Terminology
This section introduces the terminology of _Domain Functionss, Slots, Evaluation Contexts, Aliases, Constants_, and _Local Functions_. The following section will combine these concepts into two syntax proposals.

### Domain Functions
Assume that a backend service is represented by an asynchronous call to a function that takes a single JSON serializable object and returns a Promise to another JSON serializable object.

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

### A note about Slots
Note that a `Domain` function takes a single parameter of type `Serializable`. Some uses may adopt the _convention_ that the parameter is a flat property bag of named `slots`. It is important to note that this design takes no position on the shape of the parameter and the concept of `slots`. Whether to organize the parameter around `slots` is a decision for the users.

### Context
Assume that we also have available a `Context` object that provides bindings to each of the available `Domains`. Here is an example:

~~~typescript
type Context = Record<string, Domain<any, any> | Serializable>;

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

A second rational for aliases is to provide the LLM with an opportunity to document an inner monologue of smaller steps, via a sequence of variable bindings and comments.

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
