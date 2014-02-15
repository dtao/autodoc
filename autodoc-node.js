var Autodoc = require('./autodoc'),
    Lazy    = require('lazy.js');

Autodoc.options.codeParser      = require('esprima');
Autodoc.options.commentParser   = require('doctrine');
Autodoc.options.markdownParser  = require('marked');
Autodoc.options.templateEngine  = require('mustache');
Autodoc.options.highlighter     = require('codemirror-highlight');
Autodoc.options.exampleHandlers = require('./resources/javascripts/defaults.js').exampleHandlers;

Autodoc.options.compiler = {
  'javascript': {
    compile: function(source) {
      return source;
    }
  },

  'coffeescript': (function(compiler) {

    function compile(source, options) {
      var js = compiler.compile(source, options);

      // Basically we want to eliminate blank lines after block comments so that
      // Autodoc can do the whole associate-doclets-with-functions thing. I'm
      // not sure if this is the best approach, but it feels better than having
      // more logic in autodoc.js to handle varying amounts of space between
      // comments and functions for different languages. (Though there is a not-
      // super-unlikely chance that I will completely reverse my opinion on
      // this.)
      var justAfterComment = false;
      var lines = Lazy(js).split('\n').filter(function(line) {
        if ((/^\s*$/).test(line) && justAfterComment) {
          return false;
        }

        justAfterComment = false;
        if ((/^\s*\*\//).test(line)) {
          justAfterComment = true;
        }

        return true;
      });

      return lines.join('\n');
    }

    return { compile: compile };

  }(require('coffee-script')))
};

module.exports = Autodoc;
