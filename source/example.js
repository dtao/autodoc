/**
 * @fileOverview A bunch of math functions
 * @name math.js
 */

/**
 * Sums the elements of an array.
 *
 * @param {Array.<number>} array
 * @returns {number}
 *
 * @examples
 * sum([])        => 0
 * sum([1])       => 1
 * sum([1, 2, 3]) => 6
 */
function sum(array) {
  var sum = 0;
  for (var i = 0; i < array.length; ++i) {
    sum += array[i];
  }
  return sum;
}

/**
 * Calculates the mean (average value) of the elements in an array.
 *
 * @param {Array.<number>} array
 * @returns {number}
 *
 * @examples
 * mean([])           => undefined
 * mean([1])          => 1
 * mean([1, 2, 3])    => 2
 * mean([1, 2, 3, 4]) => 2.5
 */
function mean(array) {
  if (array.length === 0) {
    return undefined;
  }
  return sum(array) / array.length;
}

/**
 * Calculates the median (middle value) of the elements in an array. If the
 * array has an even number of elements, averages the middle two values.
 *
 * @param {Array.<number>} array
 * @returns {number}
 *
 * @examples
 * median([])              => undefined
 * median([1])             => 1
 * median([1, 4, 5])       => 4
 * median([1, 4, 5, 1000]) => 4.5
 */
function median(array) {
  var values = clone(array);

  // Sort the values numerically.
  values.sort(function(x, y) { return x - y; });

  var middle = Math.floor(values.length / 2);

  return isEven(values.length) ?
    mean(values.slice(middle - 1, middle + 1)) :
    values[middle];
}

/**
 * Calculates the mode (most common value) of the elements in an array.
 *
 * @param {Array.<number>} array
 * @returns {number}
 *
 * @examples
 * mode([])              => undefined
 * mode([1])             => 1
 * mode([1, 1, 2])       => 1
 * mode([1, 1, 2, 2, 2]) => 2
 */
function mode(array) {
  var values = {},
      mode,
      count = 0;

  for (var i = 0; i < array.length; ++i) {
    (function(value) {
      values[value] = values[value] || 0;
      values[value] += 1;
      if (values[value] > count) {
        mode = value;
        ++count;
      }
    }(array[i]));
  }
  
  return mode;
}

/**
 * Checks if a number is divisible by a given factor.
 *
 * @param {number} value
 * @param {number} factor
 * @returns {boolean}
 *
 * @examples
 * isDivisibleBy(10, 5) => true
 * isDivisibleBy(10, 3) => false
 * isDivisibleBy(3, 9)  => false
 */
function isDivisibleBy(value, factor) {
  return value % factor === 0;
}

/**
 * Checks if a number is a factor of a given value.
 *
 * @param {number} factor
 * @param {number} value
 * @returns {boolean}
 *
 * isFactorOf(5, 10) => true
 * isFactorOf(3, 10) => false
 * isFactorOf(9, 3)  => false
 */
function isFactorOf(factor, value) {
  return isDivisibleBy(value, factor);
}

/**
 * Checks if a number is even (divisible by 2).
 *
 * @param {number} value
 * @returns {boolean}
 *
 * @examples
 * isEven(1)    => false
 * isEven(2)    => true
 * isEven(1024) => true
 */
function isEven(value) {
  return isDivisibleBy(value, 2);
}

/**
 * Checks if a number is odd (not divisible by 2).
 *
 * @param {number} value
 * @returns {boolean}
 *
 * @examples
 * isOdd(1)    => true
 * isOdd(2)    => false
 * isOdd(1024) => false
 */
function isOdd(value) {
  return !isEven(value);
}

/**
 * Creates a shallow copy of an array.
 *
 * @param {Array.<*>} array
 * @returns {Array}
 *
 * @examples
 * clone([1, 2, 3]) => [1, 2, 3]
 */
function clone(array) {
  return array.slice(0);
}
