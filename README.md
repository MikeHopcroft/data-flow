## Specification

A plan defines a DataFlow composition of asynchronous domain service calls. The domain service calls are linked together by named aliases that reference the results of earlier calls.

### Plan Structure

A plan is a hierarchy
* rooted at a top-level set of `aliases`
* each of which binds to a `string` or a set of named `Domains`
* each of which consists of a set of named `Slots`
* whose values are arrays of strings.

Here's an example:
~~~yaml
alias1:
  domain1:
    slot1:
      - value1
      - value2
    slot2:
      -value3
  domain2:
    slot3:
      -value4
alias2: hello, world
~~~

Here is the type system:
~~~typescript
type Plan = Record<Alias, DomainSet | string>;

type Alias = string;

type DomainSet = Record<DomainName, DomainSlots>
type DomainName = string;

type DomainSlots = Record<SlotName, SlotValue>
type SlotName = string;
type SlotValue = string[];
~~~

### Alias Semantics

For the moment, let's consider the case where aliases only bind to sets of `Domains`. We will return to string-valued aliases at a later point.

A plan consists of a set of aliases, each of which specifies a set of `Domains`.

Think of each `Domain` as specifying an async function call to a service, with the domain's `Slots` representing the parameters of the call.

An `alias` is evaluated by replacing each its `Domains` with the result of its evaluation. Consider the plan

~~~yaml
A:
  flights:
    airline: United
    flight: 5117
~~~

which binds the alias `A` to the `flights` domain. Evaluating this plan involves invoking an async call to the `flights` domain service, which might result in the following fully evaluated plan:

~~~yaml
A:
  flights:
    - airline: United
      flight: 5117
      from: DEN
      to: CNY
      departs: 2023-12-02T16:00:00-0800
      arrives: 2023-12-02T17:17:00-0800
~~~

### Referencing Aliases

Aliases exist as a form of abstraction and as a means for bringing together the results of multiple domain service invocations. Specifically they help with
* Referencing the result of one domain service call in multiple locations. Without aliasing, the call would need to be inserted in multiple locations.
* Chaining multiple domain service calls together by using the results of one call to parameterize another call.
* Reshaping results through projection and other transformations to be more suitable for the next stage.

The mechanism for referencing an alias is string interpolation in slot values. String interpolation is denoted by `${expression}` in a slot value string. The expression syntax and semantics is a very narrow subset of Javascript consisting of the composition of the following elements:
* Integer literals, e.g. 1, 2, -1
* String literals with escape codes, e.g. 'hello,\nworld'
* Array literals, e.g. [1, A]
* Object literals, e.g. {flight: 1234, from: 'DEN'}
* Labels, e.g. slot names like `A` or built-in symbols like `today`.
* Dot expressions like `A.flights` or `tomorrow.morning`.
* Local function invocations like `next(Thursay).at('3:00pm')`

### Plan Semantics

Every plan must define a `result` alias. The value of the `result` alias is the value of the plan. Other aliases will only be evaluated if they are on a reference chain from `result`. 

### Plan Syntax Optimizations

While type of a Plan can be expressed in JSON schema, we choose to use YAML for the serialization format because
* YAML uses slightly less tokens than JSON
* YAML is easier for humans to read than JSON
* YAML provides the opportunity to incorporate comments, either for training examples or for the model to provide an inner monologue.
* YAML requires less careful escaping when embedding string literals in string-valued fields.

**CONTROVERSIAL:** To reduce token counts further and be more permissive in the face of language model variability we accept the type `string` or `string[]` for slot values. When we encounter a slot of type `string` in the serialized format, we convert it to a `string[]` with one element.

### Plan Semantics Optimizations

**CONTROVERSIAL:** When evaluating `aliases` that specify a single `Domain`, we replace the `Record<DomainName, DomainSlots>` with the result of the domain service call. When the domain service call returns an array with a single element, we replace it with the element. Consider the following plan from the discussion of alias semantics:

~~~yaml
A:
  flights:
    airline: United
    flight: 5117
~~~

In the earlier example, we stated that evaluation would yield
~~~yaml
A:
  flights:
    - airline: United
      flight: 5117
      from: DEN
      to: CNY
      departs: 2023-12-02T16:00:00-0800
      arrives: 2023-12-02T17:17:00-0800
~~~

With this optimization the plan would evaluate to
~~~yaml
A:
  airline: United
  flight: 5117
  from: DEN
  to: CNY
  departs: 2023-12-02T16:00:00-0800
  arrives: 2023-12-02T17:17:00-0800
~~~

The rationale for this shortcut is that it saves on LLM tokens and completion complexity, allowing the LLM to generate, say `${A.from}`, instead of `${A.flights[0].from}`.

### String-valued Aliases

Earlier we stated that aliases can bind to string values as well as sets of `Domains`. This functionality is intended primarily for the `result` alias, when the intention is to reshape or return a composition of results from a number of different domains. One can use string interpolation to return an array or object literal of references to other aliases. For more information, see the example below relating to Array and Object Literals in String Interpolation.

## Examples

### Plan Step Alias Binding

One can bind the result of a plan step to an alias, which can be referenced via string interpolation in a later step. In this example, the information about the first flight is bound to the alias, `outbound`. Likewise, the second flight is bound to `return`. These aliases are referenced, via string interpolation, in the slots of the `car` domain.

*"Find me rental car options for a trip I'm planning for 10/10 through the 15th. My flights are United 5117 outboud, returning on flight 5030."*

~~~yaml
outbound:
  flights:
    date: 10/10/23
    airline: United
    number: 5117
return:
  flights:
    date: 10/15/23
    airline: United
    number: 5030
result:
  car:
    location: ${outbound.destination}
    pickup: 10/10/23 ${outbound.arrives}
    dropoff: 10/10/23 ${return.departs.minus(1, hour)}
~~~

### Support for Date/Time operations in string interpolations

A number of date/time convenience functions are included in the string interpolation context to assist the language model in generating relative date/time values like `next Thursday at 3pm`.

The data/time functionality includes a number of starting values such as

- today
- tomorrow
- yesterday

and functions such as
- next(unit)
- last(unit)
- this(unit)

that take parameters like

- week
- month
- year
- Sunday
- Monday
- Tuesday
- Wednesday
- Thursday
- Friday
- Saturday
- morning
- midday
- afternoon
- evening
- night
- endofday
- closeofbusiness

The date/time value uses a flow-style API where additional refinements can be chained. 
- at(time)
- plus(quantity, unit)
- minus(quantity, unit)

For example, *"close of business 23 days from last Friday"* might be expressed as

~~~
${last(Friday).plus(23, days).closeofbusiness}
~~~

Here's an example.

**User:** *"What are my options for getting from San Francisco to LA next Thursday?"*

~~~yaml
result:
  flights:
    origin: SFO
    destination: LAX
    departing: ${next(Thursday)}
  trains:
    from: San Francisco
    to: Los Angeles
    date: ${next(Thursday)}
  busses:
    departing: San Francisco
    arriving: Los Angeles
    date: ${next(Thursday)}
~~~

### Array and Object Literals in String Interpolation

Array literals can be used to combine the results of multiple domains.

**User:**  *"Show me flights tomorrow from New York to Los Angeles?"*

~~~yaml
jkf:
  flights:
    origin: JFK
    destination: LAX
    departing: ${tomorrow}
lga:
  flights:
    origin: LGA
    destination: LAX
    departing: ${tomorrow}
ewr:
  flights:
    origin: EWR
    destination: LAX
    departing: ${tomorrow}
result: ${[jfk, lga, ewr]}
~~~

One could have used object literals instead:
~~~yaml
result: ${{jfk, lga, ewr}}
~~~

Object literals can explicitly specify property names as in
~~~yaml
result: ${{ option1: jfk, option2: lga, option2: ewr}}
~~~
