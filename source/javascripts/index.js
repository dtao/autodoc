//= require lib/codemirror
//= require lib/codemirror/mode/javascript
//= require common

window.addEventListener('load', function() {
  var left = document.getElementById('left'),
      right = document.getElementById('right'),
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
});
