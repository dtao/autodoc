/**
 * @name redundant
 *
 * @fileOverview
 * This library re-implements the functionality of some of JavaScript's core objects (e.g., `Array`,
 * `String`). It is intended only as a convenient way to illustrate what you can do with
 * [Breakneck](https://github.com/dtao/breakneck).
 */

/**
 * @namespace R
 */
var R = {
  arrays: {},
  objects: {},
  strings: {}
};

/**
 * Clones the elements of an array. This duplicates the native functionality of simply calling
 * `Array.prototype.slice(0)`.
 *
 * @param {Array.<*>} array The array you want to clone.
 * @returns {Array.<*>} A new array containing the same elements as the original one.
 *
 * @examples
 * R.arrays.clone([])        // => []
 * R.arrays.clone([1, 2, 3]) // => [1, 2, 3]
 *
 * @benchmarks
 * R.arrays.clone([1, 2, 3, 4, 5]) // redundant.js
 * [1, 2, 3, 4, 5].slice(0)        // native
 */
R.arrays.clone = function(array) {
  var clone = [];
  for (var i = 0; i < array.length; ++i) {
    clone.push(array[i]);
  }
  return clone;
};

/**
 * Inserts an element into an array. This duplicates the native functionality of `Array.prototype.splice`.
 *
 * @param {Array.<*>} array The array you want to insert an element into.
 * @param {number} index The index where you want the element inserted.
 * @param {*} element The element to insert.
 * @returns {Array.<*>} The array with the element inserted.
 *
 * @examples
 * R.arrays.insert([1, 2], 1, 'foo') // => [1, 'foo', 2]
 *
 * @benchmarks
 * R.arrays.insert([1, 2, 3, 4, 5], 2, 'foo') // redundant.js
 * [1, 2, 3, 4, 5].splice(2, 0, 'foo')        // native
 */
R.arrays.insert = function(array, index, element) {
  array.push(array[array.length - 1]);
  
  for (var i = array.length - 1; i > index; --i) {
    array[i] = array[i - 1];
  }
  
  array[index] = element;
  return array;
};

/**
 * Gets the keys of an object. This duplicates the native `Object.keys` method.
 *
 * @param {Object} object The object whose keys you want to get.
 * @returns {Array.<string>} The keys of the object.
 *
 * @examples
 * R.objects.keys({ foo: 1, bar: 2 }) // => ['foo', 'bar']
 *
 * @benchmarks
 * R.objects.keys({ foo: 1, bar: 2, baz: 3 }) // redundant.js
 * Object.keys({ foo: 1, bar: 2, baz: 3 })    // native
 */
R.objects.keys = function(object) {
  var keys = [];
  for (var key in object) {
    keys.push(key);
  }
  return keys;
};

/**
 * Splits a string by a given delimiter. This duplicates `String.prototype.split`.
 *
 * @param {string} string The string to split.
 * @param {string} delimiter The delimiter used to split the string.
 * @returns {Array.<string>} An array of the parts separated by the given delimiter.
 *
 * @examples
 * R.strings.split('1,2,3', ',')   // => ['1', '2', '3']
 * R.strings.split('hello', 'ell') // => ['h', 'o']
 *
 * @benchmarks
 * R.strings.split('foo bar baz', ' ') // redundant.js
 * 'foo bar baz'.split(' ')            // native
 */
R.strings.split = function(string, delimiter) {
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
};

if (typeof module === 'object' && module && module.exports) {
  module.exports = R;
}
