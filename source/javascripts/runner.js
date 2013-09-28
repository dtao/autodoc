importScripts(
  'lib/esprima.js',
  'lib/jasmine.js',
  'lib/lazy.js'
);

function getExamplesFromData(data) {
  var ast = esprima.parse(data, { comment: true });

  var examples = Lazy(ast.comments)
    .map(function(comment) { return comment.value.split('\n'); })
    .flatten()
    .map(function(line) {
      var match = line.match(/^[\s\*]*(.*)\s+=>\s*(.*)\s*$/);
      if (!match) {
        return null;
      }

      return {
        input: match[1],
        output: match[2]
      };
    })
    .compact()
    .toArray();

  return examples;
}

function createReporter() {
  return {
    reportSpecResults: function(spec) {
      var outcome = {
        input: spec.input,
        output: spec.output,
        result: spec.results().passed() ? 'passed' : 'failed',
        messages: Lazy(spec.results().getItems()).map(function(item) {
          return {
            message: item.message,
            trace: item.trace.stack
          };
        }).toArray()
      };

      postMessage(JSON.stringify(outcome));
    }
  };
}

this.onmessage = function(e) {
  var data = e.data;

  eval(data);

  Lazy(getExamplesFromData(data)).each(function(example) {
    describe('blah', function() {
      var spec = it(example.input + ' should return ' + example.output, function() {
        expect(eval(example.input)).toEqual(eval(example.output));
      });

      spec.input = example.input;
      spec.output = example.output;
    });
  });

  var jasmineEnv = jasmine.getEnv();
  jasmineEnv.updateInterval = 1000;

  jasmineEnv.addReporter(createReporter());

  jasmineEnv.execute();
};
