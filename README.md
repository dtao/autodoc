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

I want this library to be pretty non-intrusive. What I mean is, I don't want libraries to have to add all of these Breakneck-specific tags and annotations everywhere. So I'm just piggybacking off of JsDoc for the most part.

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
