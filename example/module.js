(function(context) {

  var Submodule = {
    /**
     * Returns 1.
     *
     * @examples
     * Module().m1() // => 1
     */
    m1: function() {
      return 1;
    },

    /**
     * Returns 2.
     *
     * @examples
     * Module().m2() // => 2
     */
    m2: function() {
      return 2;
    }
  };

  var Module = function() {
    return Submodule;
  };

  // Expose Submodule directly.
  Module.Submodule = Submodule;

  module.exports = Module;

  // Sandwich the module.exports line with this weird cyclical reference
  // just to ensure it gets picked out properly.
  Submodule.Submodule = Submodule;

}(this));
