/**
 * @name redundant
 *
 * @fileOverview
 * This library re-implements the functionality of some of JavaScript's core objects (e.g., `Array`,
 * `String`). It is intended only as a convenient way to illustrate what you can do with
 * [Autodoc](https://github.com/dtao/autodoc).
 */

/**
 * @namespace R
 */
var R = {
  arrays: {},
  objects: {},
  strings: {},
  numbers: {}
};

/**
 * Clones the elements of an array. This duplicates the native functionality of simply calling
 * `Array.prototype.slice(0)`.
 *
 * @param {Array.<*>} array The array you want to clone.
 * @returns {Array.<*>} A new array containing the same elements as the original one.
 *
 * @examples
 * var arr1 = [],
 *     arr2 = R.arrays.clone(arr1);
 *
 * arr2.push('foo');         // arr1.length == 0
 * R.arrays.clone([])        // instanceof Array
 * R.arrays.clone([])        // => []
 * R.arrays.clone([1, 2, 3]) // => [1, 2, 3]
 * R.arrays.clone(null)      // throws
 *
 * var arr3 = R.arrays.clone(arr2); // => ['foo']
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
 * Maps the elements of an array onto a new array. This duplicate the native functionality of
 * calling `Array.prototype.map(fn)`.
 *
 * @param {Array.<*>} array The array you want to map.
 * @param {function(*):*} fn The mapping function.
 * @returns {Array.<*>} An array containing the results from mapping each element in the source
 *     array to a new array.
 *
 * @example
 * [1, 2, 3].map(function(x) {
 *   return x * -1;
 * });
 * // => [-1, -2, -3]
 *
 * // This comment should not be included
 * ['foo', 'bar'].map(function(str) {
 *   return str.toUpperCase();
 * });
 * // => ['FOO', 'BAR']
 *
 * [1.5, 3.14].map(Math.floor); // => [1, 3]
 * [[], [1, 2], 'foo', { length: 'bar' }].map(function(obj) {
 *   return obj.length;
 * });
 * // => [0, 2, 3, 'bar']
 */
R.arrays.map = function(array, fn) {
  var result = Array(array.length);
  for (var i = 0, len = array.length; i < len; ++i) {
    result[i] = fn(array[i]);
  }
  return result;
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
 * R.arrays.insert([1, 2], 1, 'foo')
 * // => [1, 'foo', 2]
 *
 * R.arrays.insert([], 0, { foo: 'bar' }) // => [{
 *   foo: 'bar'
 * }]
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

R.objects = {
  /**
   * Gets the keys of an object. This duplicates the native `Object.keys` method.
   *
   * @param {Object} object The object whose keys you want to get.
   * @returns {Array.<string>} The keys of the object.
   *
   * @example
   * R.objects.keys({ foo: 1, bar: 2 }) // => ['foo', 'bar']
   *
   * @benchmarks
   * R.objects.keys({ foo: 1, bar: 2, baz: 3 }) // redundant.js
   * Object.keys({ foo: 1, bar: 2, baz: 3 })    // native
   */
  keys: function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    return keys;
  }
};

var strings = {
  /**
   * Splits a string by a given delimiter. This duplicates `String.prototype.split`.
   *
   * @memberOf R.strings
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
  split: function(string, delimiter) {
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
};

R.strings = strings;

/**
 * Parses a string as a number. This duplicates `Number`, `parseInt`, and
 * `parseFixed`.
 *
 * @memberOf R.numbers
 * @param {string} string The string to parse.
 * @returns {number} The parsed number.
 *
 * @examples
 * R.numbers.parse('5')         // => 5
 * R.numbers.parse('123')       // => 123
 * R.numbers.parse(' 123 ')     // => 123
 * R.numbers.parse(' 3.14 ')    // => 3.14
 * R.numbers.parse('0123')      // => 123
 * R.numbers.parse(' 0123 ')    // => 123
 * R.numbers.parse('03.14')     // => 3.14
 * R.numbers.parse('123456789') // => 123456789
 * R.numbers.parse('1234.5678') // => 1234.5678
 * R.numbers.parse('')          // NaN
 * R.numbers.parse('foo')       // NaN
 * R.numbers.parse('1.23.45')   // NaN
 *
 * @benchmarks
 * R.numbers.parse('123456789') // redundant.js
 * Number('123456789')          // native (Number)
 * parseInt('123456789', 10)    // native (parseInt)
 */
R.numbers['parse'] = function(string) {
  var state   = 0,
      index   = 0,
      len     = string.length,
      whole   = NaN,
      decimal = 0,
      power   = 0,
      digit;

  // States:
  // 0 - leading space
  // 1 - number
  // 2 - decimal
  // 3 - trailing space
  while (index < len) {
    digit = string.charCodeAt(index++) - 48;

    switch (digit) {
      case -16: // space
      case -35: // carriage return
      case -38: // newline
      case -39: // tab
        if (state === 1 || state === 2) {
          state = 3;
          continue;
        }
        if (state === 0 || state === 3) {
          continue;
        }
        return NaN;

      case -2: // decimal point
        if (state === 1) {
          state = 2;
          continue;
        }
        return NaN;
    }

    if (digit < 0 || digit > 9) {
      return NaN;
    }

    switch (state) {
      case 0:
        state = 1;
        whole = digit;
        continue;

      case 1:
        whole = (whole * 10) + digit;
        continue;

      case 2:
        decimal += (digit * Math.pow(10, --power));
        continue;
    }
  }

  return whole + decimal;
};

if (typeof module === 'object' && module && module.exports) {
  module.exports = R;
}
