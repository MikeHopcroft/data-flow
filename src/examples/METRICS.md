# Metrics Example

The sample shows the computation of text and token Levenshtein edit distances between various forms of expressions. 
The source code is in [metrics.ts](./metrics.ts).

The expression forms are
* **original** - the original expression source, verbatim, including white space and comments.
* **cannonical** - the result of parsing and then serializing the original expression. White space and comments are removed and aliases definitions appear in sorted order.
* **resolved** - the serialization of the AST formed by replacing each of the reference nodes with its value.

The sample compares the following expression pairs:
* **identical:** 'return 123' and 'return 123'
* **different semantics:** 'return 123' and 'return 456'
* **equivalent semantics:** ' a = 123;  return a' and 'b = 123; return b'
* **equivalent semantics:** 'a = 123; b=a; return b' and 'b=a; a = 123; return b'

Here's the output from a run:

~~~
$ node build/src/examples/example2.js
-------------------------------------------
a:
  Original:
    Text: return 123
    Tokens: 693, 220, 4513
  Cannonical:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
  Resolved:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
b:
  Original:
    Text: return 123
    Tokens: 693, 220, 4513
  Cannonical:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
  Resolved:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
Distances for each input type and form:
  original-text: 0
  original-tokens: 0
  cannonical-text: 0
  cannonical-tokens: 0
  resolved-text: 0
  resolved-tokens: 0
-------------------------------------------
a:
  Original:
    Text: return 123
    Tokens: 693, 220, 4513
  Cannonical:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
  Resolved:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
b:
  Original:
    Text: return 456
    Tokens: 693, 220, 10961
  Cannonical:
    Text: return 456;
    Tokens: 693, 220, 10961, 26
  Resolved:
    Text: return 456;
    Tokens: 693, 220, 10961, 26
Distances for each input type and form:
  original-text: 3
  original-tokens: 1
  cannonical-text: 3
  cannonical-tokens: 1
  resolved-text: 3
  resolved-tokens: 1
-------------------------------------------
a:
  Original:
    Text:  a = 123;  return a
    Tokens: 264, 284, 220, 4513, 26, 220, 471, 264
  Cannonical:
    Text: a=123;return a;
    Tokens: 64, 28, 4513, 26, 693, 264, 26
  Resolved:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
b:
  Original:
    Text: b = 123; return b
    Tokens: 65, 284, 220, 4513, 26, 471, 293
  Cannonical:
    Text: b=123;return b;
    Tokens: 65, 28, 4513, 26, 693, 293, 26
  Resolved:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
Distances for each input type and form:
  original-text: 4
  original-tokens: 3
  cannonical-text: 2
  cannonical-tokens: 2
  resolved-text: 0
  resolved-tokens: 0
-------------------------------------------
a:
  Original:
    Text: a = 123; b=a; return b
    Tokens: 64, 284, 220, 4513, 26, 293, 25222, 26, 471, 293
  Cannonical:
    Text: a=123;b=a;return b;
    Tokens: 64, 28, 4513, 56033, 25222, 26, 693, 293, 26
  Resolved:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
b:
  Original:
    Text: b=a; a = 123; return b
    Tokens: 65, 25222, 26, 264, 284, 220, 4513, 26, 471, 293
  Cannonical:
    Text: a=123;b=a;return b;
    Tokens: 64, 28, 4513, 56033, 25222, 26, 693, 293, 26
  Resolved:
    Text: return 123;
    Tokens: 693, 220, 4513, 26
Distances for each input type and form:
  original-text: 10
  original-tokens: 7
  cannonical-text: 0
  cannonical-tokens: 0
  resolved-text: 0
  resolved-tokens: 0
~~~
