/**
 * This is a contrived test file containing a bunch of "unusual" node types. The
 * goal is just to get Autodoc to parse this file successfully; that's all.
 */
(function() {
  /**
   * Prints the even numbers up to N.
   *
   * @global
   * @param {number} N
   */
  function printEvens(N) {
    try {
      var i = -1;

      beginning:
      do {
        if (++i < N) {
          if (i % 2 !== 0) {
            continue beginning;
          }

          printNumber(i);
        }

        break;

      } while (true);

    } catch (e) {
      debugger;
    }
  }

  function printNumber(n) {
    var number, logN;

    with (Math) {
      number = n;
      logN = log(n);
      console.log('Number: ' + number + ' (log: ' + logN + ')');
    }
  }

  this.printEvens = printEvens;

}.call(this));
