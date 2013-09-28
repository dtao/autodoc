//= require lib/jasmine
//= require lib/benchmark
//= require lib/jquery
//= require lib/lazy
//= require lib/highcharts
//= require lib/hightables

$(document).ready(function() {
  Highcharts.setOptions({
    colors: getColors()
  });

  function getColors() {
    var palette = $('#color-reference');

    var colors = Lazy(['primary', 'info', 'success', 'warning', 'danger', 'default'])
      .map(function(brand) {
        return $('.' + brand, palette).css('background-color');
      })
      .toArray();

    return colors;
  }

  function showSection(section) {
    // Hide all other sections.
    $('section').hide();

    // Show just the target section.
    $(section).show();
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
        Lazy(spec.results().getItems())
          .filter(function(item) { return item.passed && !item.passed(); })
          .pluck('message')
          .each(function(errorMessage) {
            $('<li>')
              .text(errorMessage)
              .appendTo(errorsList);

            $('<p>')
              .text(errorMessage)
              .appendTo(failureNotices);
          });
      }
    });

    jasmineEnv.execute();
  }

  $(document).on('click', 'nav a', function(e) {
    e.preventDefault();

    var targetSection = $(this).attr('href');
    showSection($(targetSection));
  });

  $(document).on('click', '.perf button', function() {
    var button = $(this);
    var suite  = new Benchmark.Suite();

    // Get the method name from the section heading.
    var section = $(this).closest('section');
    var method  = $('h1', section).text();

    // Gather up all the benchmarks we want to run for this method.
    Lazy(benchmarks[method]).each(function(benchmark, name) {
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

  showSection($('section:first-of-type'));
  runSpecs();
});
