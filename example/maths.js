/**
 * A humble little maths library.
 */
var Maths = {
  /**
   * Checks if a number is an integer.
   *
   * @param {number} x The number to check.
   * @returns {boolean} Whether or not `x` is an integer.
   *
   * @examples
   * Maths.isInteger(5)     // => true
   * Maths.isInteger(5.0)   // => true
   * Maths.isInteger(3.14)  // => false
   * Maths.isInteger('foo') // => false
   * Maths.isInteger(NaN)   // => false
   *
   * @benchmarks
   * var number = 12345;
   *
   * Maths.isInteger(number)       // using Maths.isInteger
   * String(number).match(/^\d+$/) // using simple regex
   */
  isInteger: function(x) {
    return x === Math.floor(x);
  }
};

module.exports = Maths;