/**
 * Just some simple number helpers.
 */
(function(Numbers) {

  /**
   * Checks if a number is an integer. Returns false for anything that isn't an
   * integer, including non-numbers.
   *
   * @private
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
    return x === Math.floor(x);
  };

  /**
   * Checks if a value looks like an integer. Returns true for both integers and
   * strings that represent integers, false for everything else.
   *
   * @private
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
    return (/^\d+$/).test(String(x));
  };

}(typeof module === 'object' ? (module.exports = {}) : (this.Numbers = {})));
