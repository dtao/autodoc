var Breakneck = require('./breakneck');
var Lazy = require('lazy.js');

var context = {};
context.markdownParser = require('marked');
context.codeParser = require('esprima');
context.commentParser = require('doctrine');

var unboundParse = Breakneck.parse;
Breakneck.parse = function(code, options) {
  options = Lazy(options || {}).defaults(context).toObject();
  return unboundParse(code, options);
}

module.exports = Breakneck;
