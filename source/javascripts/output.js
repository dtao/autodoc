//= require lib/codemirror
//= require lib/codemirror/mode/javascript
//= require lib/lazy
//= require lib/mustache
//= require common

window.addEventListener('load', function() {
  var sections      = document.querySelectorAll('section'),
      checkboxes    = document.querySelectorAll('footer input[type="checkbox"]'),
      astCheckBox   = document.querySelector('input[name="ast"]'),
      docsCheckBox  = document.querySelector('input[name="docs"]');

  // The CodeMirror instance where we'll display the AST.
  var astEditor = CodeMirror.fromTextArea(document.querySelector('#ast textarea'), {
    mode: 'javascript',
    theme: 'solarized light',
    lineNumbers: true,
    readOnly: true
  });

  // The iframe where we'll display the full documentation.
  var docsFrame = document.querySelector('#docs iframe'),
      parentDoc = document;

  var latestResult,
      docsTemplate;

  function updateAST(data) {
    var parser = new Worker('/javascripts/parser.js');

    parser.addEventListener('message', function(e) {
      astEditor.setValue(e.data);
    });

    parser.postMessage(data);
  }

  function updateDocs(data) {
    var generator = new Worker('/javascripts/generator.js');

    generator.addEventListener('message', function(e) {
      // Replace the iframe.
      docsFrame.parentNode.replaceChild(parentDoc.createElement('IFRAME'), docsFrame);
      docsFrame = parentDoc.querySelector('#docs iframe');

      var documentation = JSON.parse(e.data),
          frameDoc      = docsFrame.contentWindow.document,
          frameSrc      = Mustache.render(docsTemplate, documentation);

      frameDoc.open();
      frameDoc.write(frameSrc);
      frameDoc.close();

      docsFrame.parentNode.removeAttribute('class');
    });

    docsFrame.parentNode.className = 'loading';

    generator.postMessage(data);

    // Give the worker 3 seconds to finish.
    setTimeout(function() {
      generator.terminate();
    }, 3000);
  }

  function showingAST() {
    return astCheckBox.checked;
  }

  function showingDocs() {
    return docsCheckBox.checked;
  }

  function showSection(name) {
    for (var i = 0; i < sections.length; ++i) {
      if (sections[i].id === name) {
        sections[i].style.display = 'block';
      } else {
        sections[i].style.display = 'none';
      }
    }
  }

  function updateCurrentSection() {
    if (showingAST()) {
      updateAST(latestResult);

    } else if (showingDocs()) {
      updateDocs(latestResult);
    }
  }

  for (var i = 0; i < checkboxes.length; ++i) {
    checkboxes[i].addEventListener('change', function(e) {
      for (var j = 0; j < checkboxes.length; ++j) {
        if (checkboxes[j] !== e.target) {
          checkboxes[j].checked = false;
        }
      }

      showSection(e.target.name);
      updateCurrentSection();
    });
  }

  window.addEventListener('message', function(e) {
    if (e.origin === window.location.origin) {
      latestResult = e.data;
      updateCurrentSection();
    }
  });

  showSection('docs');

  makeGetRequest('/docs.html.mustache', function(html) {
    docsTemplate = html;
  });
});
