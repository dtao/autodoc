(function(root, factory) {

  root.Genie = factory();

}(this, function() {

  /**
   * Does whatever.
   */
  var Genie = {
    /**
     * Does something.
     */
    foo: function() {},

    /**
     * Does something else.
     */
    bar: function() {}
  };

  /**
   * @private
   * @example
   * baz(); // => undefined
   */
  function baz() {

  }

  return Genie;

}));
