/**
 * @private
 * @examples
 * [1, 2, 'foo'].numbers(); // => [1, 2]
 */
Array.prototype.numbers = function() {
  return _.filter(this, function(x) { return typeof x === 'number'; });
};
