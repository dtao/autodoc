Project "Breakneck"
===================

This is just a little something I'm working on to help eliminate a lot of the gruntwork involved in setting up a new JavaScript project. Here is where I'm coming from:

1. What we *really* want to be doing as JavaScript devs is **write code**, and not fiddle around with a project website.
2. **BUT** it's important for your project to have a nice website (with a landing page, API docs, etc.) if it's going to have the kind of impact you want.

How do we solve this problem? We make step 2 happen automatically as a result of step 1!

How?
----

So, first off, this is very much an active work in progress.

That said, here's how you use it:

1. Install breakneck: `npm install breakneck`
2. Comment your code according to the conventions described below (mostly JsDoc, with a few additions).
3. Run `breakneck [your JS file]`

Conventions
-----------

By default, the `breakneck` command will put the following files in the **docs** folder:

docs/
    index.html
    docs.js
    docs.css

You can change which folder you want this stuff dumped to w/ the `-o` or `--output` option.

You can also just run specs from the command line by passing the `-t` or `--test` option.

Alternately, you can simply dump a JSON representation of everything Breakneck reads from your library using the `-d` or `--dump` option.

To spice up your API docs with some custom JavaScript, add a file called **doc_helper.js** to the output folder. Breakneck will automatically detect it there and add a `<script>` tag referencing it to the resulting HTML. You can add other arbitrary JavaScript files by providing a comma-delimited list via the `--javascripts` option.

You can create your own **docs.css** file, or modify the one Breakneck puts there, and Breakneck will not overwrite it. You can also specify your own template (currently only Mustche templates are supported, though that will change) using the `--template` option. Note that in this case, some other features are not guaranteed to work; e.g., Breakneck would not magically know where to add `<script>` tags linking to **doc_helper.js** or other custom JavaScript files. You'd need to put those in the template yourself.

### Documentation

API docs will be generated based on the comments above each function. This includes information from `@param` and `@returns` tags. See [JsDoc](http://usejsdoc.org/) for details. You can also use [Markdown](http://daringfireball.net/projects/markdown/) to format your comments.

Use the `@name` tag in a comment at the top of the file for Breakneck to know the name of your library. Use the `@fileOverview` tag to provide a high-level description.

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

For every example in your comments, the expected output will first be checked against all of your custom handlers (in order) to see if there's a match; otherwise, Breakneck will perform a simple equality comparison using a method called `assertEquality`.

By default Breakneck uses [Jasmine](http://pivotal.github.io/jasmine/)\*\*, so under the hood `assertEquality` is implemented using `expect(a).toEqual(b)`. If you want to implement your own `assertEquality` method, add a file called **assertEquality.js** to your output folder with something like this:

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

<sub>\*\*I am aware that not everybody loves Jasmine. I plan to add support for other test runners at some point... although, it doesn't *really* matter that much since you're not using the interface anyway. (The only thing that should matter to Breakneck users is how results are reported by the test framework. And what functionality is available within **handlers.js**, I suppose.)</sub>

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

You can restrict Breakneck's output to only certain namespaces within your library via the `--namespaces` option. You can also only generate documentation for methods with certain arbitrary tags (e.g., `@public`) using the `--tags` option, which takes a comma-separated list.
