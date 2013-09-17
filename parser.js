importScripts(
  'lib/esprima/esprima.js'
);

this.onmessage = function(e) {
  var ast  = esprima.parse(e.data, { comment: true, loc: true });
  postMessage(JSON.stringify(ast, null, 2));
};
