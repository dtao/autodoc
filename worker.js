// This is a hack to make Lazy.js work.
// (TODO: update the library to not explicitly require a 'window' object in the browser.)
this.window = this;

importScripts('lib/esprima/esprima.js', 'lib/lazy.js/lazy.js');

this.onmessage = function(e) {
  var ast = esprima.parse(e.data, {
    comment: true,
    loc: true
  });

  var functionDeclarations = Lazy(ast.body)
    .where({ type: 'FunctionDeclaration' })
    .groupBy(function(decl) { return decl.loc.start.line; })
    .toObject();

  var parseComment = function(comment) {
    var functionDeclaration = functionDeclarations[comment.loc.end.line + 1];
    if (!functionDeclaration) {
      return null;
    }

    return {
      'value': comment.value,
      'function': functionDeclaration[0].id.name
    };
  };

  var comments = Lazy(ast.comments).map(parseComment)
    .compact()
    .toArray();

  postMessage(JSON.stringify(comments, null, 2));
};
