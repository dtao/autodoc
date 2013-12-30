/**
 * Just some simple number helpers.
 */
(function(Numbers) {

  /**
   * @private
   * @examples
   * isInteger(5)     // => true
   * isInteger(5.0)   // => true
   * isInteger(-5)    // => true
   * isInteger(3.14)  // => false
   * isInteger('foo') // => false
   * isInteger(NaN)   // => false
   */
  function isInteger(x) {
    return x === Math.floor(x);
  }

  /**
   * Checks if a number is an integer. Returns false for anything that isn't an
   * integer, including non-numbers.
   *
   * @examples
   * Numbers.isInteger(5)     // => true
   * Numbers.isInteger(5.0)   // => true
   * Numbers.isInteger(-5)    // => true
   * Numbers.isInteger(3.14)  // => false
   * Numbers.isInteger('foo') // => false
   * Numbers.isInteger(NaN)   // => false
   */
  Numbers.isInteger = function(x) {
    return isInteger(x);
  };

  /**
   * @private
   * @examples
   * isIntegerLike(123)  // => true
   * isIntegerLike(3.14) // => false
   */
  function isIntegerLike(x) {
    return (/^\d+$/).test(String(x));
  }

  /**
   * Checks if a value looks like an integer. Returns true for both integers and
   * strings that represent integers, false for everything else.
   *
   * @examples
   * Numbers.isIntegerLike(123)  // => true
   * Numbers.isIntegerLike(3.14) // => false
   *
   * @benchmarks
   * Numbers.isInteger(123456789)     // using Math.floor
   * Numbers.isIntegerLike(123456789) // using RegExp: ^\d+$
   */
  Numbers.isIntegerLike = function(x) {
    return isIntegerLike(x);
  };

}(typeof module === 'object' ? (module.exports = {}) : (this.Numbers = {})));
