# data-flow

The purpose of this project is to explore ways in which a Large Language Model (LLM) can initiate a sequence of chained asynchronous calls to back-end services. The approach centers around a lightweight syntax for LLMs to express a computation `Plan`, based on the composition of service calls.

The syntax is an ***extremely limited subset of Javascript syntax***, relating mainly to the staging of function parameters, invoking functions, and reshaping return values in order to pass them to other functions. 

Here's an example use case related to travel booking. Consider the following user utterance:

*"Find me rental car options for a trip I'm planning for 10/10 through the 15th. My flights are United 5117 outboud, returning on flight 5030."*

In response, the language model might generate a dataflow program that gets the city along with arrival and departure times and then queries for available rental cars:

~~~typescript
out = flights({
  date: '10/10/23',
  airline: 'United',
  number: 5117
});
back = flights({
  date: '10/15/23',
  airline: 'United',
  number: 5030
});
return cars({
  location: out.destination
  pickup: out.arrives.plus(30, minutes)
  dropoff: back.departs.minus(2, hours)
});
~~~

One can consider this program to be the body of a Javascript function whose context provides the `flights()` and `cars()` functions, along with the `minutes` and `hours` constants.

While the syntax is a strict subset of Javascript, the semantics of the language differ from Javascript in two key ways: 
1. The details of asynchronous function invocation are implicit, thus releasing the LLM from the burden of specifying this behavior.
2. Alias definitions, which use the syntax of variable assignment, are interpreted as defining a data-flow dependency graph for the `Plan`. The structure of this graph determines the maximal level of concurrancy available when evaluating a `Plan`. 


There is more information about the data-flow representation in the [specification document](./documentation/SPECIFICATION2.md).

This repo contains a number of sample applications to demonstrate the functionality:

* [Simple](src/examples/SIMPLE.md) - shows how to use the parser/evaluator
* [Metrics](src/examples/METRICS.md) - demonstrates metrics for comparing expressions

You can run these sample in GitHub Codespaces or you can clone the repo and build it locally. Instructions for both approaches follow.

## Instructions for GitHub Codespaces

1. Navigate your browser to [the repo](https://github.com/MikeHopcroft/data-flow).
1. Click on the green button labeled `<> Code`.
![Codespaces](/docs/assets/codespaces.png)
1. Click the `+` button to the right of the text that says *"Codespaces, Your Workspaces in the Cloud"*.
1. A new Codespace will start up. It will take a few minutes for it to build the dev container.
1. When the Codespace is ready, Visual Studio Code will open in the browser.
1. In the terminal at the bottom of Visual Studio Code, type the following:
~~~shell
@User ➜ /workspaces/data-flow (main) $ npm install
@User ➜ /workspaces/data-flow (main) $ npm run compile
@User ➜ /workspaces/data-flow (main) $ node build/src/apps/example1.js
~~~

## Instructions for local build

## Instructions for running samples

## Text Fragments for reuse elsewhere

This is an experimental data-flow library designed to connect Large Language Models (LLMs) to asynchrous back-end services. The library implements a parser, evaluator, and comparison functions for data-flow programs authored by LLMs.

~~~yaml
out:
  flights:
    date: 10/10/23
    airline: United
    number: 5117
back:
  flights:
    date: 10/15/23
    airline: United
    number: 5030
return:
  car:
    location: out.destination
    pickup: out.arrives.plus(30, minutes)
    dropoff: back.departs.minus(2, hours)
~~~
