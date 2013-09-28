$(document).ready(function() {
  function showSection(section) {
    // Hide all other sections.
    $('section').hide();

    // Show just the target section.
    $(section).show();
  }

  $(document).on('click', 'nav a', function(e) {
    e.preventDefault();

    var targetSection = $(this).attr('href');
    showSection($(targetSection));
  });

  $(document).on('click', '.perf button', function() {
    var suite = new Benchmark.Suite();

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

    suite.on('complete', function() {
      // Indicate that benchmarks are finished.
      perf.removeClass('loading').addClass('loaded');

      var dataTable = $('table', perf);

      var chartContainer = $('<div>')
        .addClass('bar-chart')
        .attr('data-source', '#' + dataTable.attr('id'))
        .attr('data-transpose', true)
        .insertAfter(dataTable);

      HighTables.renderChart(chartContainer[0]);
    });

    suite.run({ async: true });
  });

  showSection($('section:first-of-type'));
});
