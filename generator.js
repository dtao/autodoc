importScripts(
  'lib/doctrine/doctrine.js'
);

this.onmessage = function(e) {
  var docs = doctrine.parse(e.data, { unwrap: true });
  postMessage(JSON.stringify(docs, null, 2));
};
