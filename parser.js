// This is a hack to make Lazy.js work.
// (TODO: update the library to not explicitly require a 'window' object in the browser.)
this.window = this;

importScripts('lib/esprima/esprima.js', 'lib/lazy.js/lazy.js');

this.onmessage = function(e) {
  var ast = esprima.parse(e.data, {
    comment: true,
    loc: true
  });

  var examples = Lazy(ast.comments)
    .map(function(comment) { return comment.value.split('\n'); })
    .flatten()
    .map(function(line) {
      var match = line.match(/^[\s\*]*(.*)\s+=>\s*(.*)\s*$/);
      if (!match) {
        return null;
      }

      return {
        input: match[1],
        output: match[2]
      };
    })
    .compact()
    .toArray();

  postMessage(JSON.stringify({
    code: e.data,
    examples: examples
  }));
};
