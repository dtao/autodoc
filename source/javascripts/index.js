//= require lib/codemirror
//= require lib/codemirror/mode/javascript
//= require common

function debounce(delay, fn) {
  var timeout;

  return function() {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(fn, delay);
  };
}

window.addEventListener('load', function() {
  (function initializeSplitter() {
    var left     = document.getElementById('left'),
        right    = document.getElementById('right'),
        splitter = document.getElementById('splitter');

    // My own hacky implementation of a resizable splitter.
    splitter.addEventListener('drag', function(e) {
      var x = e.screenX - window.screenLeft;

      // Sanity check: prevent choppiness by disallowing large jumps.
      if (Math.abs(x - splitter.offsetLeft) > 100) {
        return;
      }

      splitter.style.left = x + 'px';
      left.style.right = (window.innerWidth - x) + 'px';
      right.style.left = x + 'px';
    });

    window.addEventListener('resize', function() {
      var x = splitter.offsetLeft;

      splitter.style.left = x + 'px';
      left.style.right = (window.innerWidth - x) + 'px';
      right.style.left = x + 'px';
    });
  }());

  (function initializeEditor() {
    var editor = CodeMirror.fromTextArea(document.querySelector('#left textarea'), {
      mode: 'javascript',
      theme: 'solarized dark',
      lineNumbers: true
    });

    makeGetRequest('/example2.js', function(content) {
      editor.setValue(content);
    });

    var right  = document.getElementById('right'),
        output = right.querySelector('iframe');

    editor.on('change', debounce(500, function() {
      right.className = 'loading';
      output.contentWindow.postMessage(editor.getValue(), '*');
    }));

    window.addEventListener('message', function(e) {
      if (e.data === 'loaded') {
        right.removeAttribute('class');
      }
    });
  }());
});
