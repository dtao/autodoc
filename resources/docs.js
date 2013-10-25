$(document).ready(function() {
  function highlightCode() {
    $('pre code').each(function() {
      $(this).html(hljs.highlight('javascript', this.textContent).value);
    });
  }

  function runSpecs() {
    var failureNotices = $('#spec-failures');

    var jasmineEnv = jasmine.getEnv();

    jasmineEnv.addReporter({
      reportSpecResults: function(spec) {
        var matchingRow = $('#example-' + spec.exampleId);
        var resultCell = $('td:last-child', matchingRow);

        if (spec.results().passed()) {
            resultCell.text('Passed');
            return;
        }

        matchingRow.addClass('danger');

        var errorsList = $('<ul>').appendTo(resultCell);
        _(spec.results().getItems())
          .filter(function(item) { return item.passed && !item.passed(); })
          .pluck('message')
          .each(function(errorMessage) {
            $('<li>')
              .text(errorMessage)
              .appendTo(errorsList);

            var notice = $('<p>')
              .text(errorMessage)
              .appendTo(failureNotices);

            var link = $('<a>')
              .attr('href', '#example-' + spec.exampleId)
              .text('See specs')
              .appendTo(notice);
          });
      }
    });

    jasmineEnv.execute();
  }

  $(document).on('click', '#spec-failures a', function(e) {
    e.preventDefault();

    var exampleTarget = $(this).attr('href'),
        targetExample = $(exampleTarget),
        parentSection = targetExample.closest('section');

    // Show the section where the example is located.
    parentSection[0].scrollIntoView();

    // Highlight the example.
    targetExample.addClass('highlight');
    setTimeout(function() { targetExample.removeClass('highlight'); }, 750);
  });

  $(document).on('click', '.perf button', function() {
    var button = $(this);
    var suite  = new Benchmark.Suite();

    // Get the method name from the section heading.
    var section  = $(this).closest('section');
    var methodId = section.attr('id');

    // Gather up all the benchmarks we want to run for this method.
    _.each(benchmarks[methodId], function(benchmark, name) {
      suite.add(benchmark);
    });

    // Populate the perf table as benchmarks are run.
    suite.on('cycle', function(e) {
      var benchmark = e.target;
      var perfTestRow = $('#perf-test-' + benchmark.id);
      $('td:last-child', perfTestRow).text(benchmark.hz.toFixed(3));
    });

    // Indicate that benchmarks are running.
    var perf = $('.perf', section).addClass('loading');
    button.hide();

    suite.on('complete', function() {
      // Indicate that benchmarks are finished.
      perf.removeClass('loading').addClass('loaded');
      button.text('Run performance tests again').show();

      // Render a bar chart with the results.
      var dataTable = $('table', perf);
      var chartContainer = $('<div>')
        .addClass('bar-chart')
        .attr('data-source', '#' + dataTable.attr('id'))
        .insertBefore(dataTable);

      HighTables.renderChart(chartContainer[0]);
    });

    suite.run({ async: true });
  });

  highlightCode();
  runSpecs();
});

$(window).load(function() {
  window.parent.postMessage('loaded', window.location.origin);
});
