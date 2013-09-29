importScripts(
  'lib/esprima.js',
  'lib/doctrine.js',
  'lib/lazy.js',
  'lib/marked.js',
  'breakneck.js'
);

this.onmessage = function(e) {
  var data = Breakneck.parse(e.data);
  postMessage(JSON.stringify(data));
};
