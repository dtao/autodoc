(function(context) {

  var Lazy = context.Lazy;

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
        if (typeof doc === 'undefined' || (!doc.description && (!doc.examples || doc.examples.length === 0))) {
          return null;
        }

        var name        = Breakneck.getIdentifierName(fn[0]),
            description = markdownParser.parse(doc.description),
            params      = Breakneck.getParams(doc),
            returns     = Breakneck.getReturns(doc),
            signature   = Breakneck.getSignature(name, params),
            examples    = Breakneck.getExamples(doc),
            benchmarks  = Breakneck.getBenchmarks(doc);

        return {
          name: name,
          description: description,
          params: params,
          returns: returns,
          hasSignature: params.length > 0 || !!returns,
          signature: signature,
          examples: examples,
          hasExamples: examples.length > 0,
          benchmarks: benchmarks,
          hasBenchmarks: benchmarks.length > 0
        };
      })
      .compact()
      .toArray();

    // This is kind of stupid... for now, I'm just assuming the library will
    // have a @fileOverview tag and @name tag in the header comments.
    var libraryInfo = Breakneck.getLibraryInfo(ast.comments, commentParser);

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
      case 'MemberExpression': return Breakneck.getIdentifierName(node.property);
      case 'FunctionDeclaration': return node.id.name;
      case 'VariableDeclaration': return node.declarations[0].id.name;
      case 'VariableDeclarator': return node.id.name;

      case 'ExpressionStatement': return Breakneck.getIdentifierName(node.expression);

      default: return null;
    }
  };

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
   * @returns {Array.<ParameterInfo>} An array of { name, type, description } objects.
   */
  Breakneck.getParams = function(doc) {
    var Lazy = context.Lazy;

    return Lazy(doc.tags)
      .where({ title: 'param' })
      .map(function(tag) {
        return {
          name: tag.name,
          type: Breakneck.formatType(tag.type),
          description: tag.description || ''
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
   * @returns {ReturnInfo} A { type, description } object.
   */
  Breakneck.getReturns = function(doc) {
    var Lazy      = context.Lazy,
        returnTag = Lazy(doc.tags).findWhere({ title: 'returns' });

    if (typeof returnTag === 'undefined') {
      return {};
    }

    return {
      type: Breakneck.formatType(returnTag.type),
      description: returnTag.description || ''
    };
  };

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
   * @returns {LibraryInfo}
   */
  Breakneck.getLibraryInfo = function(comments, commentParser) {
    var Lazy = context.Lazy;

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
      description: marked(libraryDesc)
    };
  };

  /**
   * @callback PairCallback
   * @param {string} left
   * @param {string} right
   * @returns {*}
   */

  /**
   * Takes a doclet and a tag name, then reads all of the lines from that tag
   * and splits them across '=>', finally calling a callback on each left/right
   * pair. (Does that make any sense? Whatever.)
   *
   * @param {Object} doc
   * @param {string} tagName
   * @param {PairCallback} callback
   * @returns {Array.<*>} An array of whatever the callback returns.
   */
  Breakneck.splitCommentLines = function(doc, tagName, callback) {
    var Lazy = context.Lazy,
        tag  = Lazy(doc.tags).findWhere({ title: tagName });

    if (typeof tag === 'undefined') {
      return [];
    }

    return Lazy(tag.description.split('\n'))
      .map(function(line) {
        return line.match(/^(.*)\s*=>\s*(.*)$/);
      })
      .compact()
      .map(function(match) {
        return callback(
          match[1],
          match[2]
        );
      })
      .toArray();
  };

  /**
   * Gets the text from a given comment tag and splits it into lines.
   *
   * @param {Object} doc
   * @param {string} tagName
   * @returns {Array.<string>}
   */
  Breakneck.getCommentLines = function(doc, tagName) {
    var Lazy = context.Lazy,
        tag  = Lazy(doc.tags).findWhere({ title: tagName });

    if (typeof tag === 'undefined') {
      return [];
    }

    return tag.description.split('\n');
  };

  /**
   * @typedef {Object} ExampleInfo
   * @property {number} id
   * @property {string} input
   * @property {string} output
   */

  /**
   * Produces an array of { id, input, output } objects representing simple examples of a function.
   *
   * @param {Object} doc
   * @returns {Array.<ExampleInfo>}
   */
  Breakneck.getExamples = function(doc) {
    var Lazy = context.Lazy;

    var commentLines = Breakneck.getCommentLines(doc, 'examples');

    return Lazy(commentLines)
      .map(Breakneck.parseExample)
      .compact()
      .toArray();
  };

  /**
   * Given a line like 'input => output', parses this into a { id, input, output } object.
   *
   * @param {string} line
   * @returns {ExampleInfo|null}
   */
  Breakneck.parseExample = function(line) {
    var parts = line.match(/^(.*)\s*=>\s*(.*)$/);

    if (!parts) {
      return null;
    }

    return {
      input: trim(parts[1]),
      output: trim(parts[2])
    };
  };

  /**
   * @typedef {Object} BenchmarkInfo
   * @property {number} id
   * @property {string} name
   * @property {string} impl
   */

  /**
   * Produces an array of { id, name, impl } objects representing benchmarks for a function.
   *
   * @param {Object} doc
   * @returns {Array.<BenchmarkInfo>}
   */
  Breakneck.getBenchmarks = function(doc) {
    var benchmarkIdCounter = 1;
    return Breakneck.splitCommentLines(doc, 'benchmarks', function(left, right) {
      return {
        id: benchmarkIdCounter++,
        name: left,
        impl: right
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

      case 'TypeApplication':
        return Breakneck.formatType(type.expression) + '.<' + Lazy(type.applications).map(Breakneck.formatType).join('|') + '>';

      case 'AllLiteral':
        return '*';

      case 'OptionalType':
        return Breakneck.formatType(type.expression) + '?';

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
        return context.marked(markdown);
      }
    };
  }

  function trim(string) {
    return string.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  if (typeof module === 'object') {
    module.exports = Breakneck;
  } else {
    context.Breakneck = Breakneck;
  }

}(typeof global !== 'undefined' ? global : this));
