# data-flow

This is an experimental data-flow library designed to connect Large Language Models (LLMs) to asynchrous domain services. The library implements a parser, evaluator, and comparison functions for data-flow graphs authored by LLMs.

Here's an example use case in travel booking. In response to the following utterance, 

*"Find me rental car options for a trip I'm planning for 10/10 through the 15th. My flights are United 5117 outboud, returning on flight 5030."*

the language model might generate the following dataflow graph that gets the city along with arrival and departure times and then queries for available rental cars:

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

There is more information about the data-flow representation in the [specification](./documentation/SPECIFICATION.md).

This repo contains a number of sample applications to demonstrate the functionality:

* Sample1 - NOT YET IMPLEMENTED
* Sample2 - NOT YET IMPLEMENTED

You can run these sample in GitHub Codespaces or you can clone the repo and build it locally. Instructions for both approaches follow.

## Instructions for GitHub Codespaces

1. Navigate your browser to [the repo](https://github.com/MikeHopcroft/chat-dsl).
1. Click on the green button labeled `<> Code`.
![Codespaces](/docs/assets/codespaces.png)
1. Click the `+` button to the right of the text that says *"Codespaces, Your Workspaces in the Cloud"*.
1. A new Codespace will start up. It will take a few minutes for it to build the dev container.
1. When the Codespace is ready, Visual Studio Code will open in the browser.
1. In the terminal at the bottom of Visual Studio Code, type the following:
~~~shell
@User ➜ /workspaces/chat-dsl (main) $ yarn install
@User ➜ /workspaces/chat-dsl (main) $ tsc
@User ➜ /workspaces/chat-dsl (main) $ node build/src/apps/example1.js
~~~

## Instructions for local build

## Instructions for running samples