function makeGetRequest(dest, callback) {
  var request = new XMLHttpRequest();
  request.open('GET', dest);

  request.addEventListener('load', function() {
    callback(request.responseText);
  });

  request.send();
}

function whenInitialized(variableName, callback) {
  var storedValue = this[variableName];

  if (typeof storedValue !== 'undefined') {
    callback(storedValue);
    return;
  }

  Object.defineProperty(this, variableName, {
    enumerable: true,

    get: function() {
      return storedValue;
    },

    set: function(value) {
      storedValue = value;
      callback(storedValue);
    }
  });
}
