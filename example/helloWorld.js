/**
 * @name hello world
 *
 * @fileOverview
 * This is a description.
 */

/**
 * The main namespace.
 */
function Foo() {};

/**
 * Returns 'foo'
 *
 * @returns {string}
 */
Foo.getName = function() {
  return 'foo';
};

Foo.Bar = {
  /**
   * Returns 'bar'
   *
   * @returns {string}
   */
  getName: function() {
    return 'bar';
  },

  /**
   * Returns 'baz'
   *
   * @returns {string}
   */
  getBaz: function() {
    return 'baz';
  }
};
