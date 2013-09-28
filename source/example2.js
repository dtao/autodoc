/**
 * @name redundant.js
 *
 * @fileOverview
 * Check this out. I'm tired of putting all this work into writing code. I want
 * to basically just implement stuff and have docs, specs, and performance
 * benchmarks all generated for me. Isn't it all sort of boilerplate, after all?
 * That's the idea here.
 *
 * This example library re-implements a bunch of functionality that JavaScript's
 * core objects already have. Just for fun.
 *
 * Right now this tool will generate the following:
 *
 * Documentation
 * -------------
 * See [JsDoc](http://usejsdoc.org/) for details.
 *
 * Specs
 * -----
 * Use the `@examples` tag and separate expected inputs/outputs with '=>'. You
 * can see what I mean in the examples below.
 *
 * Benchmarks
 * ----------
 * Use the `@benchmarks` tag and separate names and implementations with '=>';
 * again, you can see what I'm talking about below.
 *
 * Oh and also
 * -----------
 * You can use [Markdown](http://daringfireball.net/projects/markdown/) to format your comments.
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
