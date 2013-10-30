(function(context) {

  var Lazy = context.Lazy;

  // Auto-require Lazy if it isn't already defined and we're in Node.
  if (typeof Lazy === 'undefined' && typeof require === 'function') {
    Lazy = require('lazy.js');
  }

  // Define a custom type of sequence that recursively walks the nodes of an
  // AST.
  Lazy.Sequence.define('nodes', {
    each: function(fn) {
      var self = this;

      self.parent.each(function(node) {
        if (fn(node) === false) {
          return false;
        }

        var children = self.getNodeChildren(node);
        if (children.length > 0) {
          return Lazy(children).nodes().each(fn);
        }
      });
    },

    getNodeChildren: function(node) {
      switch (node.type) {
        case 'FunctionDeclaration':
        case 'FunctionExpression':
          return [node.body];

        case 'BlockStatement':
          return node.body;

        case 'ExpressionStatement':
          return [node.expression];

        case 'AssignmentExpression':
          return node.right.type === 'FunctionExpression' ? [node.right] : [];

        case 'CallExpression':
          return node.callee.type === 'FunctionExpression' ? [node.callee] : [];

        default: return [];
      }
    }
  });

  /**
   * @namespace Breakneck
   */
  var Breakneck = {};

  /**
   * Parses an arbitrary blob of JavaScript code and returns an object
   * containing all of the data necessary to generate a project website with
   * docs, specs, and performance benchmarks.
   *
   * @param {string} code The JavaScript code to parse.
   * @param {Object=} options
   * @returns {Object}
   */
  Breakneck.parse = function(code, options) {
    options = options || {};

    var codeParser     = options.codeParser     || context.esprima,
        commentParser  = options.commentParser  || context.doctrine,
        markdownParser = options.markdownParser || defaultMarkdownParser();

    // Generate the abstract syntax tree.
    var ast = codeParser.parse(code, {
      comment: true,
      loc: true
    });

    // Extract all of the function from the AST, and map them to their location
    // in the code (this is so that we can associate each function with its
    // accompanying doc comments, if any).
    var functions = Lazy(ast.body).nodes()
      .filter(function(node) {
        if (node.type === 'FunctionDeclaration') {
          return true;
        }
        if (node.type === 'AssignmentExpression' && node.right.type === 'FunctionExpression') {
          return true;
        }
        return false;
      })
      .groupBy(function(node) {
        return node.loc.start.line;
      })
      .toObject();

    // Go through all of of the comments in the AST, attempting to associate
    // each with a function.
    var docs = Lazy(ast.comments)
      .map(function(comment) {

        // Find the function right after this comment. If none exists, skip it.
        var fn = functions[comment.loc.end.line + 1];
        if (typeof fn === 'undefined') {
          return null;
        }

        // Attempt to parse the comment. If it can't be parsed, or it appears to
        // be basically empty, then skip it.
        var doc = Breakneck.parseComment(comment, commentParser);
        if (typeof doc === 'undefined' || !doc.description) {
          return null;
        }

        var name        = Breakneck.parseName(Breakneck.getIdentifierName(fn[0])),
            description = markdownParser.parse(doc.description),
            params      = Breakneck.getParams(doc, markdownParser),
            returns     = Breakneck.getReturns(doc, markdownParser),
            isCtor      = Breakneck.hasTag(doc, 'constructor'),
            signature   = Breakneck.getSignature(name.shortName, params),
            examples    = Breakneck.getExamples(doc),
            benchmarks  = Breakneck.getBenchmarks(doc),
            tags        = Lazy(doc.tags).pluck('title').toArray();

        return {
          name: name.name,
          shortName: name.shortName,
          identifier: name.identifier,
          namespace: name.namespace,
          description: description,
          params: params,
          returns: returns,
          isConstructor: isCtor,
          hasSignature: params.length > 0 || !!returns,
          signature: signature,
          examples: examples,
          hasExamples: examples.examples.length > 0,
          benchmarks: benchmarks,
          hasBenchmarks: benchmarks.benchmarks.length > 0,
          tags: tags
        };
      })
      .compact()
      .toArray();

    // This is kind of stupid... for now, I'm just assuming the library will
    // have a @fileOverview tag and @name tag in the header comments.
    var libraryInfo = Breakneck.getLibraryInfo(ast.comments, commentParser, markdownParser);

    return {
      name: libraryInfo.name,
      description: libraryInfo.description,
      code: code,
      docs: docs
    };
  };

  /**
   * Gets the name of whatever identifier is associated with this node (if any).
   *
   * @param {Object} object
   * @return {Object}
   */
  Breakneck.getIdentifierName = function(node) {
    switch (node.type) {
      case 'Identifier': return node.name;
      case 'AssignmentExpression': return Breakneck.getIdentifierName(node.left);
      case 'MemberExpression': return (Breakneck.getIdentifierName(node.object) + '.' + Breakneck.getIdentifierName(node.property)).replace(/\.prototype\./, '#');
      case 'FunctionDeclaration': return node.id.name;
      case 'VariableDeclaration': return node.declarations[0].id.name;
      case 'VariableDeclarator': return node.id.name;

      case 'ExpressionStatement': return Breakneck.getIdentifierName(node.expression);

      default: return null;
    }
  };

  /**
   * @typedef {Object} NameInfo
   * @property {string} name
   * @property {string} shortName
   */

  /**
   * Takes, e.g., 'Foo#bar' and returns { name: 'Foo#bar', shortName: 'bar' }
   *
   * @param {string} name
   * @returns {NameInfo}
   */
  Breakneck.parseName = function(name) {
    var parts = name.split(/[\.#]/),

        // e.g., the short name for 'Lib.utils.func' should be 'func'
        shortName = parts.pop(),

        // a name like 'foo#bar#baz' wouldn't make sense; so we can safely join
        // w/ '.' to recreate the namespace
        namespace = parts.join('.');

    return {
      name: name,
      shortName: shortName,
      namespace: namespace,
      identifier: name.replace(/[\.#]/g, '-')
    };
  };

  /**
   * @typedef {Object} MarkdownParser
   * @property {function(string):string} parse
   */

  /**
   * @typedef {Object} ParameterInfo
   * @property {string} name
   * @property {string} type
   * @property {string} description
   */

  /**
   * Gets an array of { name, type, description } objects representing the
   * parameters of a function definition.
   *
   * @param {Object} doc The doclet for the function.
   * @param {MarkdownParser} markdownParser A Markdown parser.
   * @returns {Array.<ParameterInfo>} An array of { name, type, description } objects.
   */
  Breakneck.getParams = function(doc, markdownParser) {
    return Lazy(doc.tags)
      .where({ title: 'param' })
      .map(function(tag) {
        return {
          name: tag.name,
          type: Breakneck.formatType(tag.type),
          description: markdownParser.parse(tag.description || '')
        };
      })
      .toArray();
  };

  /**
   * @typedef {Object} ReturnInfo
   * @property {string} type
   * @property {string} description
   */

  /**
   * Get a { type, description } object representing the return value of a
   * function definition.
   *
   * @param {Object} doc The doclet for the function.
   * @param {MarkdownParser} markdownParser A Markdown parser.
   * @returns {ReturnInfo} A { type, description } object.
   */
  Breakneck.getReturns = function(doc, markdownParser) {
    var returnTag = Lazy(doc.tags).findWhere({ title: 'returns' });

    if (typeof returnTag === 'undefined') {
      return null;
    }

    return {
      type: Breakneck.formatType(returnTag.type),
      description: markdownParser.parse(returnTag.description || '')
    };
  };

  /**
   * Simply determines whether a doc has a tag or doesn't.
   *
   * @param {Object} doc The doclet to check.
   * @param {string} tagName The tag name to look for.
   * @returns {boolean} Whether or not the doclet has the tag.
   */
  Breakneck.hasTag = function(doc, tagName) {
    return !!Lazy(doc.tags).findWhere({ title: tagName });
  },

  /**
   * Produces a string representing the signature of a function.
   *
   * @param {string} name
   * @param {Array.<ParameterInfo>} params
   * @returns {string}
   */
  Breakneck.getSignature = function(name, params) {
    return 'function ' + name + '(' + Lazy(params).pluck('name').join(', ') + ')';
  };

  /**
   * @typedef LibraryInfo
   * @property {string} name
   * @property {string} description
   */

  /**
   * Returns a { name, description } object describing an entire library.
   *
   * @param {Array.<string>} comments
   * @param {Object} commentParser
   * @param {Object} markdownParser
   * @returns {LibraryInfo}
   */
  Breakneck.getLibraryInfo = function(comments, commentParser, markdownParser) {
    var docWithFileOverview = Lazy(comments)
      .map(function(comment) {
        return Breakneck.parseComment(comment, commentParser);
      })
      .compact()
      .filter(function(doc) {
        return Lazy(doc.tags).where({ title: 'fileOverview' }).any();
      })
      .first();

    var libraryName = 'Untitled Library',
        libraryDesc = '[No description]';

    if (docWithFileOverview) {
      libraryDesc = Lazy(docWithFileOverview.tags).findWhere({ title: 'fileOverview' }).description;

      var libraryNameTag = Lazy(docWithFileOverview.tags).findWhere({ title: 'name' });
      if (libraryNameTag) {
        libraryName = libraryNameTag.description;
      }
    }

    return {
      name: libraryName,
      description: markdownParser.parse(libraryDesc)
    };
  };

  /**
   * @typedef PairInfo
   * @property {string} left
   * @property {string} right
   */

  /**
   * @callback DataCallback
   * @param {{preamble:string, pairs:Array.<PairInfo>}} data
   * @returns {*}
   */

  /**
   * Takes a doclet and a tag name, then reads all of the lines from that tag
   * and splits them across '=>', finally calling a callback on each left/right
   * pair. (Does that make any sense? Whatever.)
   *
   * @param {Object} doc
   * @param {string} tagName
   * @param {DataCallback} callback
   * @returns {Array.<*>} An array of whatever the callback returns.
   */
  Breakneck.parseCommentLines = function(doc, tagName, callback) {
    var comment      = Breakneck.getTagDescription(doc, tagName),
        commentLines = comment.split('\n'),
        initialLines = [],
        pairs        = [];

    Lazy(commentLines)
      .each(function(line) {
        var pair = Breakneck.parsePair(line);

        if (!pair && pairs.length === 0) {
          initialLines.push(line);

        } else if (pair) {
          pairs.push(pair);
        }
      });

    return callback({
      content: comment,
      preamble: initialLines.join('\n'),
      pairs: pairs
    });
  };

  /**
   * Gets the text from a given comment tag.
   *
   * @param {Object} doc
   * @param {string} tagName
   * @returns {string}
   */
  Breakneck.getTagDescription = function(doc, tagName) {
    var tag = Lazy(doc.tags).findWhere({ title: tagName });

    if (typeof tag === 'undefined') {
      return '';
    }

    return tag.description;
  };

  /**
   * Given a line like 'input // => output', parses this into a { left, right } pair.
   *
   * @param {string} line
   * @returns {PairInfo|null}
   */
  Breakneck.parsePair = function(line) {
    var parts = line.match(/^(.*)\s*\/\/[ ]*(?:=>)?\s*(.*)$/);

    if (!parts) {
      return null;
    }

    return {
      left: trim(parts[1]),
      right: trim(parts[2])
    };
  };

  /**
   * @typedef {Object} ExampleInfo
   * @property {number} id
   * @property {string} input
   * @property {string} output
   */

  /**
   * @typedef {Object} ExampleCollection
   * @property {string} code
   * @property {string} setup
   * @property {Array.<ExampleInfo>} examples
   */

  /**
   * Produces a { setup, examples } object providing some examples of a function.
   *
   * @param {Object} doc
   * @returns {ExampleCollection}
   */
  Breakneck.getExamples = function(doc) {
    var exampleIdCounter = 1;
    return Breakneck.parseCommentLines(doc, 'examples', function(data) {
      return {
        code: data.content,
        setup: data.preamble,
        examples: Lazy(data.pairs).map(function(pair) {
          return {
            id: exampleIdCounter++,
            input: pair.left,
            output: pair.right
          };
        }).toArray()
      };
    });
  };

  /**
   * @typedef {Object} BenchmarkCase
   * @property {number} caseId
   * @property {string} impl
   * @property {string} name
   * @property {string} label
   */

  /**
   * @typedef {Object} BenchmarkInfo
   * @property {number} id
   * @property {string} name
   * @property {Array.<BenchmarkCase>} cases
   */

  /**
   * @typedef {Object} BenchmarkCollection
   * @property {string} code
   * @property {string} setup
   * @property {Array.<BenchmarkInfo>} benchmarks
   */

  /**
   * Produces a { setup, benchmarks } object providing some benchmarks for a function.
   *
   * @param {Object} doc
   * @returns {BenchmarkCollection}
   */
  Breakneck.getBenchmarks = function(doc) {
    var benchmarkCaseIdCounter = 1,
        benchmarkIdCounter     = 1;

    return Breakneck.parseCommentLines(doc, 'benchmarks', function(data) {
      var benchmarks = Lazy(data.pairs)
        .map(function(pair) {
          var parts = divide(pair.right, ' - ');

          return {
            caseId: benchmarkCaseIdCounter++,
            impl: pair.left,
            name: parts[0],
            label: parts[1] || 'Ops/second'
          };
        })
        .groupBy('name')
        .map(function(group) {
          return {
            id: benchmarkIdCounter++,
            name: group[0],
            cases: group[1]
          }
        })
        .toArray();

      return {
        code: data.content,
        setup: data.preamble,
        benchmarks: benchmarks,
        cases: benchmarks.length > 0 ? benchmarks[0].cases : []
      };
    });
  };

  /**
   * Produces a string representation of a type object.
   *
   * @param {Object} type
   * @returns {string}
   */
  Breakneck.formatType = function(type) {
    switch (type.type) {
      case 'NameExpression':
        return type.name;

      case 'AllLiteral':
        return '*';

      case 'TypeApplication':
        return Breakneck.formatType(type.expression) + '.<' + Lazy(type.applications).map(Breakneck.formatType).join('|') + '>';

      case 'RecordType':
        return '{' + Lazy(type.fields).map(function(field) {
          return field.key + ':' + Breakneck.formatType(field.value);
        }).join(', ');

      case 'OptionalType':
        return Breakneck.formatType(type.expression) + '?';

      case 'UnionType':
        return Lazy(type.elements).map(Breakneck.formatType).join('|');

      case 'RestType':
        return '...' + Breakneck.formatType(type.expression);

      case 'FunctionType':
        return 'function(' + Lazy(type.params).map(Breakneck.formatType).join(', ') + '):' + Breakneck.formatType(type.result);

      default:
        throw 'Unable to format type ' + type.type + '!\n\n' + JSON.stringify(type, null, 2);
    }
  };

  /**
   * Parses a comment.
   *
   * @param {string} comment The comment to parse.
   * @param {Object} commentParser The parser to use. For now this will just
   *     use Doctrine.
   * @returns {Object}
   */
  Breakneck.parseComment = function(comment, commentParser) {
    return commentParser.parse('/*' + comment.value + '*/', { unwrap: true });
  };

  function defaultMarkdownParser() {
    return {
      parse: function(markdown) {
        return context.marked(markdown).replace(/\{@link ([^\}]*)}/g, function(string, match) {
          return '<a href="#' + match.replace(/[\.#]/g, '-') + '">' + match + '</a>';
        });
      }
    };
  }

  function trim(string) {
    return string.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function divide(string, divider) {
    var seam = string.indexOf(divider);
    if (seam === -1) {
      return [string];
    }

    return [string.substring(0, seam), string.substring(seam + divider.length)];
  }

  if (typeof module === 'object') {
    module.exports = Breakneck;
  } else {
    context.Breakneck = Breakneck;
  }

}(typeof global !== 'undefined' ? global : this));
