// OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG OMG ZOMG!!!1
importScripts(
  'lib/doctrine/doctrine.js'
);

this.onmessage = function(e) {
  var data = JSON.parse(e.data),
      docs = doctrine.parse(data.code, { unwrap: true });

  postMessage(JSON.stringify(docs, null, 2));
};
