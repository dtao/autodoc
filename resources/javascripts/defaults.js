(function(context) {

  /**
   * Default example handlers. These come AFTER any custom handlers --
   * that gives you the ability to override them, effectively. (Of course you
   * could also always just obliterate this property.)
   */
  this.exampleHandlers = (context.exampleHandlers || []).concat([
    {
      pattern: /^\s*instanceof (.*)\s*$/,
      test: function(match, actual) {
        var expectedType = match[1],
            isInstance   = eval('actual instanceof ' + expectedType);

        if (!isInstance) {
          throw 'Expected ' + actual + ' to be an instance of ' + expectedType;
        }
      }
    }
  ]);

  // A client library may have defined a custom assertEquality method, e.g.
  // in doc_helper.js; so we'll only use this default implementation if
  // necessary.
  this.assertEquality = context.assertEquality || function(expected, actual) {
    expect(actual).toEqual(expected);
  };

}.call(this, typeof global !== 'undefined' ? global : this));
