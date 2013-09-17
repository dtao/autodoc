/**
 * Parses a date from a string, attempting to make an intelligent guess as to the format.
 * If a year is not specified, uses the current year.
 * 
 * @examples
 * parseDate('9/13/2013')  => new Date(2013, 8, 13)
 * parseDate('2013/9/13')  => new Date(2013, 8, 13)
 * parseDate('2013-09-13') => new Date(2013, 8, 13)
 * parseDate('9/13')       => new Date(2013, 8, 13)
 * parseDate('29/6/1984')  => new Date(1984, 5, 29)
 */
function parseDate(str) {
  var parts = str.split(/[\/\-]/),
      year  = extractYear(parts),
      month = inferMonth(parts),
      date  = inferDate(parts);
  return new Date(year, month, date);
}

/*
 * Infers the year from an array of numeric strings and removes it from the array.
 */
function extractYear(parts) {
  if (parts.length < 3) {
    return new Date().getFullYear();
  }
  
  if (parts[0].length === 4) {
    return Number(parts.splice(0, 1)[0]);
  }
  
  return Number(parts.splice(2, 1)[0]);
}

function inferMonth(parts) {
  var x = Number(parts[0]),
      y = Number(parts[1]);
  return x <= 12 ? (x - 1) : (y - 1);
}

function inferDate(parts) {
  if (parts.length > 2) {
  }
  var x = Number(parts[0]),
      y = Number(parts[1]);
  return x > 12 ? x : y;
}

/*
 * Splits an array using the same logic as String.prototype.split.
 *
 * splitArray([1, 2, 3], 2) => [[1], [3]]
 */
function splitArray(array, delimiter) {
  var chunks = [],
      chunk  = [],
      i      = -1;

  while (++i < array.length) {
    if (array[i] === delimiter) {
      chunks.push(chunk);
      chunk = [];

    } else {
      chunk.push(array[i]);
    }
  }

  chunks.push(chunk);

  return chunks;
}
