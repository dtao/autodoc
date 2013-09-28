/**
 * @name Project "Breakneck"
 *
 * @fileOverview
 * This is just a little something I'm working on to help eliminate a lot of the gruntwork involved
 * in setting up a new JavaScript project. The rationale here is twofold:
 *
 * 1. What we *really* want to be doing as JavaScript devs is **write code**, and not fiddle around
 *    with a project website. **BUT**:
 * 2. Meanwhile, it's important for your project to have a nice website if it's going to have the
 *    kind of impact you want.
 *
 * How do we solve this problem? We make step 2 happen automatically as a result of step 1!
 *
 * Well, this is nowhere near "usable" yet, as a library. But as a hacky little web-based tool, here's
 * what it can do so far:
 *
 * Documentation
 * -------------
 * API docs will be generated based on the comments above each function. This includes information from
 * `@param` and `@returns` tags. See [JsDoc](http://usejsdoc.org/) for details. You can use
 * [Markdown](http://daringfireball.net/projects/markdown/) to format your comments.
 *
 * Specs
 * -----
 * Use the `@examples` tag to define specs in an extremely concise format. You can see what I mean
 * in the examples below. The result will be a table in the API docs indicating your spec results.
 *
 * Benchmarks
 * ----------
 * Use the `@benchmarks` tag to specify cases you want to profile for performance. This will automatically
 * add a benchmark runner in the appropriate place in the docs, along with a bar chart! (Pick a method and
 * click 'Run performance benchmarks' to see for yourself!)
 *
 * ---
 *
 * *The "library" below is what I'll nickname **redundant.js**, as it re-implements the functionality of
 * some of JavaScript's core objects (e.g., `Array`, `String`). It is intended only as a convenient way
 * to illustrate what I'm trying to do here.*
 */

/**
 * Clones the elements of an array. This duplicates the native functionality of simply calling
 * `Array.prototype.slice(0)`.
 *
 * @param {Array.<*>} array The array you want to clone.
 * @returns {Array.<*>} A new array containing the same elements as the original one.
 *
 * @examples
 * clone([])        => []
 * clone([1, 2, 3]) => [1, 2, 3]
 *
 * @benchmarks
 * redundant.js => clone([1, 2, 3, 4, 5])
 * native       => [1, 2, 3, 4, 5].slice(0)
 */
function clone(array) {
  var clone = [];
  for (var i = 0; i < array.length; ++i) {
    clone.push(array[i]);
  }
  return clone;
}

/**
 * Inserts an element into an array. This duplicates the native functionality of `Array.prototype.splice`.
 *
 * @param {Array.<*>} array The array you want to insert an element into.
 * @param {number} index The index where you want the element inserted.
 * @param {*} element The element to insert.
 * @returns {Array.<*>} The array with the element inserted.
 *
 * @examples
 * insert([1, 2], 1, 'foo') => [1, 'foo', 2]
 *
 * @benchmarks
 * redundant.js => insert([1, 2, 3, 4, 5], 2, 'foo')
 * native       => [1, 2, 3, 4, 5].splice(2, 0, 'foo')
 */
function insert(array, index, element) {
  array.push(array[array.length - 1]);
  
  for (var i = array.length - 1; i > index; --i) {
    array[i] = array[i - 1];
  }
  
  array[index] = element;
  return array;
}

/**
 * Gets the keys of an object. This duplicates the native `Object.keys` method.
 *
 * @param {Object} object The object whose keys you want to get.
 * @returns {Array.<string>} The keys of the object.
 *
 * @examples
 * keys({ foo: 1, bar: 2 }) => ['foo', 'bar']
 *
 * @benchmarks
 * redundant.js => keys({ foo: 1, bar: 2, baz: 3 })
 * native       => Object.keys({ foo: 1, bar: 2, baz: 3 })
 */
function keys(object) {
  var keys = [];
  for (var key in object) {
    keys.push(key);
  }
  return keys;
}

/**
 * Splits a string by a given delimiter. This duplicates `String.prototype.split`.
 *
 * @param {string} string The string to split.
 * @param {string} delimiter The delimiter used to split the string.
 * @returns {Array.<string>} An array of the parts separated by the given delimiter.
 *
 * @examples
 * split('1,2,3', ',')   => ['1', '2', '3']
 * split('hello', 'ell') => ['h', 'o']
 *
 * @benchmarks
 * redundant.js => split('foo bar baz', ' ')
 * native       => 'foo bar baz'.split(' ')
 */
function split(string, delimiter) {
  var start = 0,
      parts = [],
      index = string.indexOf(delimiter);

  while (index !== -1) {
    parts.push(string.substring(start, index));
    start = index + delimiter.length;
    index = string.indexOf(delimiter, start);
  }

  if (start < string.length) {
    parts.push(string.substring(start));
  }

  return parts;
}
