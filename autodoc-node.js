var Autodoc = require('./autodoc');

Autodoc.options.codeParser     = require('esprima');
Autodoc.options.commentParser  = require('doctrine');
Autodoc.options.markdownParser = require('marked');
Autodoc.options.templateEngine = require('mustache');

module.exports = Autodoc;
