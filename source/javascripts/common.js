function makeGetRequest(dest, callback) {
  var request = new XMLHttpRequest();
  request.open('GET', dest);

  request.addEventListener('load', function() {
    callback(request.responseText);
  });

  request.send();
}
