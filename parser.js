importScripts(
  'lib/esprima/esprima.js'
);

this.onmessage = function(e) {
  var ast  = esprima.parse(e.data);
  postMessage(JSON.stringify(ast, null, 2));
};
