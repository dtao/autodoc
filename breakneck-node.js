var Breakneck = require('./breakneck');

Breakneck.options.codeParser     = require('esprima');
Breakneck.options.commentParser  = require('doctrine');
Breakneck.options.markdownParser = require('marked');

module.exports = Breakneck;
