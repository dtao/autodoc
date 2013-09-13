// See parser.js.
this.window = this;

importScripts(
  'lib/jasmine/lib/jasmine-core/jasmine.js',
  'lib/lazy.js/lazy.js'
);

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
  var data = JSON.parse(e.data);

  eval(data.code);

  Lazy(data.examples).each(function(example) {
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
