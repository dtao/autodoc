Project "Autodoc"
===================

This is just a little something I'm working on to help eliminate a lot of the gruntwork involved in creating a JavaScript project. In particular it simplifies **writing and running tests**, and **generating API documentation**.

Here, let's play Show Don't Tell. Assume we have a file named **maths.js** with the following content:

```javascript
var Maths = {};

/**
 * Checks if a number is an integer.
 *
 * @param {number} x The number to check.
 * @returns {boolean} Whether or not `x` is an integer.
 *
 * @examples
 * Maths.isInteger(5)        // => true
 * Maths.isInteger(5.0)      // => true
 * Maths.isInteger(3.14)     // => false
 * Maths.isInteger('foo')    // => false
 * Maths.isInteger(NaN)      // => false
 */
Maths.isInteger = function(x) {
  return x === Math.floor(x);
};

module.exports = Maths;
```

We can use Autodoc to **translate those comments into runnable tests**:

    $ autodoc -t maths.js

![Specs screenshot](http://breakneck.danieltao.com/images/specs_screenshot.png)

And what do we get without the `-t` option?

    $ autodoc maths.js

Auto-generated documentation... *with* the specs right in the docs.

![Docs screenshot](http://breakneck.danieltao.com/images/docs_screenshot.png)

Get the idea?

Conventions
-----------

By default, the `autodoc` command will put the following files in the **docs** folder:

    docs/
        index.html
        docs.js
        docs.css

You can change which folder you want this stuff dumped to w/ the `-o` or `--output` option.

You can also just run specs from the command line by passing the `-t` or `--test` option.

Alternately, you can simply dump a JSON representation of everything Autodoc reads from your library using the `-d` or `--dump` option.

To spice up your API docs with some custom JavaScript, add a file called **doc_helper.js** to the output folder. Autodoc will automatically detect it there and add a `<script>` tag referencing it to the resulting HTML. You can add other arbitrary JavaScript files by providing a comma-delimited list via the `--javascripts` option.

You can create your own **docs.css** file, or modify the one Autodoc puts there, and Autodoc will not overwrite it. You can also specify your own template (currently only Mustche templates are supported, though that will change) using the `--template` option. Note that in this case, some other features are not guaranteed to work; e.g., Autodoc would not magically know where to add `<script>` tags linking to **doc_helper.js** or other custom JavaScript files. You'd need to put those in the template yourself.

### Documentation

API docs will be generated based on the comments above each function. This includes information from `@param` and `@returns` tags. See [JsDoc](http://usejsdoc.org/) for details. You can also use [Markdown](http://daringfireball.net/projects/markdown/) to format your comments.

Use the `@name` tag in a comment at the top of the file for Autodoc to know the name of your library. Use the `@fileOverview` tag to provide a high-level description.

### Specs

Use the `@examples` tag to define specs in an extremely concise format:

```javascript
/*
 * myFunction(input1) // => expectedResult1
 * myFunction(input2) // => expectedResult2
 */
```

The result will be a table in the API docs displaying your spec results.

You can provide custom handlers to do something a little more advanced than a straight-up equality comparison here (e.g., say your library creates some fancy object, but you just want to verify certain properties with an object literal). To do this, add a file called **handlers.js** to your output folder (whatever you specified with `-o`, or **docs** by default) and in it define a global\* `exampleHandlers` array that looks like this:

```javascript
this.exampleHandlers = [
  {
    pattern: /pattern 1/,
    test: function(match, actual) {
      // some logic to run when pattern 1 is matched
    }
  },
  {
    pattern: /pattern 2/,
    test: function(match, actual) {
      // some logic to run when pattern 2 is matched
    }
  },
  ...
];
```

For every example in your comments, the expected output will first be checked against all of your custom handlers (in order) to see if there's a match; otherwise, Autodoc will perform a simple equality comparison using a method called `assertEquality`.

By default Autodoc uses [Jasmine](http://pivotal.github.io/jasmine/)\*\*, so under the hood `assertEquality` is implemented using `expect(a).toEqual(b)`. If you want to implement your own `assertEquality` method, add a file called **assertEquality.js** to your output folder with something like this:

```javascript
this.assertEquality = function(expected, actual) {
  // Maybe for this hypothetical library we don't care about capitalization.
  if (typeof expected === 'string') {
    expected = expected.toLowerCase();
  }
  if (typeof actual === 'string') {
    actual = actual.toLowerCase();
  }

  expect(actual).toEqual(expected);
};
```

<sub>\*Yeah yeah, I know, *globals are bad*. I need to think about this...</sub>

<sub>\*\*I am aware that not everybody loves Jasmine. I plan to add support for other test runners at some point... although, it doesn't *really* matter that much since you're not using the interface anyway. (The only thing that should matter to Autodoc users is how results are reported by the test framework. And what functionality is available within **handlers.js**, I suppose.)</sub>

### Benchmarks

Use the `@benchmarks` tag to specify cases you want to profile for performance. The format is similar to `@examples`:

```javascript
/**
 * @benchmarks
 * doSomething(shortString)  // short string
 * doSomething(mediumString) // medium string
 * doSomething(longString)   // long string
 */
```

This will automatically add a benchmark runner in the appropriate place in the docs, along with a bar chart.

You can also group your benchmarks, e.g., by input size, simply by adding `" - [something to group by]"`; for instance:

```javascript
/**
 * @benchmarks
 * doSomething('foo')  // first approach - foo
 * doSomething2('foo') // second approach - foo
 * doSomething('bar')  // first approach - bar
 * doSomething2('bar') // second approach - bar
 */
```

This will cause the resulting bar chart to display grouped results.

### Other options

You can restrict Autodoc's output to only certain namespaces within your library via the `--namespaces` option. You can also only generate documentation for methods with certain arbitrary tags (e.g., `@public`) using the `--tags` option, which takes a comma-separated list.
