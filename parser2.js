// Yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah
// I KNOW.
importScripts(
  'lib/esprima/esprima.js'
);

this.onmessage = function(e) {
  var data = JSON.parse(e.data),
      ast  = esprima.parse(data.code);

  postMessage(JSON.stringify(ast, null, 2));
};
