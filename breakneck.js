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
   * @typedef {Object} Parser
   * @property {function(string):*} parse
   */

  /**
   * @typedef {Object} ExampleHandler
   * @property {RegExp} pattern
   * @property {function(Array.<string>, *):*} test
   */

  /**
   * @typedef {Object} TemplateEngine
   * @property {function(string, Object):string} render
   */

  /**
   * @typedef {Object} BreakneckOptions
   * @property {Parser|function(string):*} codeParser
   * @property {Parser|function(string):*} commentParser
   * @property {Parser|function(string):*} markdownParser
   * @property {Array.<string>} namespaces
   * @property {Array.<string>} tags
   * @property {Array.<string>} javascripts
   * @property {string} template
   * @property {TemplateEngine} templateEngine
   * @property {Array.<ExampleHandler>} exampleHandlers
   */

  /**
   * @constructor
   * @param {BreakneckOptions=} options
   */
  function Breakneck(options) {
    options = Lazy(options || {})
      .defaults(Breakneck.options)
      .toObject();

    this.codeParser      = wrapParser(options.codeParser);
    this.commentParser   = wrapParser(options.commentParser);
    this.markdownParser  = wrapParser(options.markdownParser, processInternalLinks);
    this.namespaces      = options.namespaces || [];
    this.tags            = options.tags || [];
    this.javascripts     = options.javascripts || [];
    this.template        = options.template;
    this.templateEngine  = options.templateEngine;
    this.exampleHandlers = options.exampleHandlers;
  }

  /**
   * Default Breakneck options. (See breakneck-node.js)
   */
  Breakneck.options = {};

  /**
   * @typedef {Object} LibraryInfo
   * @property {string} name
   * @property {string} description
   * @property {string} code
   * @property {Array.<NamespaceInfo>} namespaces
   */

  /**
   * Creates a Breakneck instance with the specified options and uses it to
   * parse the given code.
   *
   * @param {string} code The JavaScript code to parse.
   * @param {BreakneckOptions=} options
   * @returns {LibraryInfo}
   */
  Breakneck.parse = function(code, options) {
    return new Breakneck(options).parse(code);
  };

  /**
   * Creates a Breakneck instance with the specified options and uses it to
   * generate HTML documentation from the given code.
   *
   * @param {string} source The source code of the library.
   * @param {BreakneckOptions} options
   * @returns {string} The HTML for the library's API docs.
   */
  Breakneck.generate = function(source, options) {
    return new Breakneck(options).generate(source);
  };

  /**
   * Parses an arbitrary blob of JavaScript code and returns an object
   * containing all of the data necessary to generate a project website with
   * docs, specs, and performance benchmarks.
   *
   * @param {string} code The JavaScript code to parse.
   * @returns {LibraryInfo}
   */
  Breakneck.prototype.parse = function(code) {
    var breakneck = this;

    // Generate the abstract syntax tree.
    var ast = this.codeParser.parse(code, {
      comment: true,
      loc: true
    });

    // This is kind of stupid... for now, I'm just assuming the library will
    // have a @fileOverview tag and @name tag in the header comments.
    var librarySummary = breakneck.getLibrarySummary(ast.comments);

    // Extract all of the functions from the AST, and map them to their location
    // in the code (this is so that we can associate each function with its
    // accompanying doc comments, if any).
    var functions = Lazy(ast.body).nodes()
      .filter(function(node) { return !!Breakneck.getIdentifierName(node); })
      .groupBy(function(node) { return node.loc.start.line; })
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
        var doc = breakneck.parseComment(comment);
        if (typeof doc === 'undefined' || !doc.description) {
          return null;
        }

        return breakneck.createFunctionInfo(fn, doc);
      })
      .compact();

    // Only include documentation for functions with the specified tag(s), if
    // provided.
    if (this.tags.length > 0) {
      docs = docs.filter(function(doc) {
        return Lazy(doc.tags).contains(breakneck.tags);
      });
    }

    // Group by namespace so that we can keep the docs organized.
    docs = docs
      .groupBy(function(doc) {
        return doc.namespace || doc.shortName;
      })
      .toObject();

    // Only include specified namespaces, if the option has been provided.
    // Otherwise use all namespaces.
    var namespaces = Lazy(this.namespaces || Object.keys(docs))
      .map(function(namespace) {
        return Breakneck.createNamespaceInfo(docs, namespace);
      })
      .toArray();

    // TODO: Make this code a little more agnostic about the whole namespace
    // thing. I'm pretty sure there are plenty of libraries that don't use
    // this pattern at all.
    return {
      name: librarySummary.name,
      description: librarySummary.description,
      code: code,
      namespaces: namespaces
    };
  };

  /**
   * Generates HTML for the API docs for the given library (as raw source code)
   * using the specified options, including templating library.
   *
   * @param {string} source The source code of the library.
   * @returns {string} The HTML for the library's API docs.
   */
  Breakneck.prototype.generate = function(source) {
    var templateData = this.parse(source);

    // Allow a library to provide a config.js file, which should define an array
    // of handlers like:
    //
    // [
    //   { pattern: /regex/, test: function(match, actual) },
    //   { pattern: /regex/, test: function(match, actual) },
    //   ...
    // ]
    //
    var exampleHandlers = this.exampleHandlers;
    if (exampleHandlers.length > 0) {
      // Look at all of our examples. Those that are matched by some handler, we
      // will leave to be verified by handler.test, which will obviously need to
      // be available in the output HTML (bin/breakneck ensures this).
      Lazy(templateData.docs)
        .map(function(doc) {
          return doc.examples.examples;
        })
        .flatten()
        .each(function(example) {
          Lazy(exampleHandlers).each(function(handler, i) {
            if (handler.pattern.test(example.output)) {
              // Mark this example as being handled
              example.customHandler = true;
              example.handlerIndex = i;

              // Force output to look like a string, so we can dump it in the
              // middle of a <script> tag without a syntax error.
              example.outputPattern = JSON.stringify(example.output);

              // Exit early -- we found our handler!
              return false;
            }
          });
        });
    }

    // Additional stuff we want to tack on.
    templateData.javascripts = this.javascripts;

    // Finally pass our awesomely-finessed data to the template engine,
    // e.g., Mustache.
    return this.templateEngine.render(this.template, templateData);
  };

  /**
   * @typedef {Object} FunctionInfo
   * @property {string} name
   * @property {string} description
   * @property {boolean} isConstructor
   * @property {boolean} isStatic
   * @property {boolean} hasExamples
   * @property {boolean} hasBenchmarks
   * @property {Array.<ParameterInfo>} params
   * @property {Array.<ReturnInfo>} returns
   * @property {ExampleCollection} examples
   * @property {BenchmarkCollection} benchmarks
   * @property {Array.<string>} tags
   */

  /**
   * Takes a function node from the AST along with its associated doclet (from
   * parsing its comments) and generates an object with boatloads of data on it,
   * useful for passing to a templating system such as Mustache.
   *
   * @param {Object} fn
   * @param {Object} doc
   * @returns {FunctionInfo}
   */
  Breakneck.prototype.createFunctionInfo = function(fn, doc) {
    var nameInfo    = Breakneck.parseName(Breakneck.getIdentifierName(fn[0])),
        description = this.markdownParser.parse(doc.description),
        params      = this.getParams(doc),
        returns     = this.getReturns(doc),
        isCtor      = Breakneck.hasTag(doc, 'constructor'),
        isStatic    = nameInfo.name.indexOf('#') === -1, // That's right, hacky smacky
        signature   = Breakneck.getSignature(nameInfo, params),
        examples    = Breakneck.getExamples(doc),
        benchmarks  = Breakneck.getBenchmarks(doc),
        tags        = Lazy(doc.tags).pluck('title').toArray();

    return {
      name: nameInfo.name,
      shortName: nameInfo.shortName,
      identifier: nameInfo.identifier,
      namespace: nameInfo.namespace,
      description: description,
      params: params,
      returns: returns,
      isConstructor: isCtor,
      isStatic: isStatic,
      hasSignature: params.length > 0 || !!returns,
      signature: signature,
      examples: examples,
      hasExamples: examples.examples.length > 0,
      benchmarks: benchmarks,
      hasBenchmarks: benchmarks.benchmarks.length > 0,
      tags: tags
    };
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
   * @returns {Array.<ParameterInfo>} An array of { name, type, description }
   *     objects.
   */
  Breakneck.prototype.getParams = function(doc) {
    var markdownParser = this.markdownParser;

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
   * @returns {ReturnInfo} A { type, description } object.
   */
  Breakneck.prototype.getReturns = function(doc) {
    var returnTag = Lazy(doc.tags).findWhere({ title: 'returns' });

    if (typeof returnTag === 'undefined') {
      return null;
    }

    return {
      type: Breakneck.formatType(returnTag.type),
      description: this.markdownParser.parse(returnTag.description || '')
    };
  };

  /**
   * @typedef LibrarySummary
   * @property {string} name
   * @property {string} description
   */

  /**
   * Returns a { name, description } object describing an entire library.
   *
   * @param {Array.<string>} comments
   * @returns {LibrarySummary}
   */
  Breakneck.prototype.getLibrarySummary = function(comments) {
    var breakneck = this;

    var docWithFileOverview = Lazy(comments)
      .map(function(comment) {
        return breakneck.parseComment(comment);
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
      description: this.markdownParser.parse(libraryDesc)
    };
  };

  /**
   * Parses a comment.
   *
   * @param {string} comment The comment to parse.
   * @returns {Object}
   */
  Breakneck.prototype.parseComment = function(comment) {
    return this.commentParser.parse('/*' + comment.value + '*/', { unwrap: true });
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
   * @property {string} namespace
   * @property {string} identifier
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
   * @param {NameInfo} name
   * @param {Array.<ParameterInfo>} params
   * @returns {string}
   */
  Breakneck.getSignature = function(name, params) {
    var formattedParams = '(' + Lazy(params).pluck('name').join(', ') + ')';

    if (name.name === name.shortName) {
      return 'function ' + name.shortName + formattedParams;
    } else {
      return name.namespace + '.' + name.shortName + ' = function' + formattedParams;
    }
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
   * @typedef {Object} NamespaceInfo
   * @property {string} namespace
   * @property {FunctionInfo} constructorMethod
   * @property {Array.<FunctionInfo>} members
   * @property {Array.<FunctionInfo>} allMembers
   */

  /**
   * Finds all of the functions in a library belonging to a certain namespace
   * and creates a { namespace, constructorMethod, members, allMembers } object
   * from each, with members sorted in a UI-friendly order.
   *
   * @param {Object.<string, Array.<FunctionInfo>>} docs
   * @param {string} namespace
   * @returns {NamespaceInfo}
   */
  Breakneck.createNamespaceInfo = function(docs, namespace) {
    // Find the corresponding constructor, if one exists.
    var constructorMethod = Lazy(docs)
      .values()
      .flatten()
      .findWhere({ name: namespace });

    // Get all the members that are part of the specified namespace, excluding
    // the constructor (if applicable), and sort them alphabetically w/ so-called
    // "static" members coming first.
    var members = Lazy(docs[namespace])
      .reject(function(doc) {
        return doc.name === namespace;
      })
      .sortBy(function(doc) {
        // Talk about hacky...
        // This is how I've decided to put static methods first.
        return (doc.isStatic ? 'a' : 'b') + doc.shortName;
      })
      .toArray();

    // For templating purposes, it will also be useful to have a collection
    // comprising ALL members, in this order:
    //
    // 1. constructor
    // 2. static methods
    // 3. instance methods
    var allMembers = Lazy([constructorMethod]).concat(members)
      .compact()
      .toArray();

    // Decorate these docs w/ a meaningful "type" (this is more useful than just
    // a boolean flag, and it's easier to do here than in the template).
    Lazy(allMembers).each(function(member) {
      member.sectionType = member.isConstructor ? 'constructor' : 'method';
    });

    return {
      namespace: namespace,
      constructorMethod: constructorMethod,
      members: members,
      allMembers: allMembers
    };
  };

  /**
   * Takes either a `{ parse }` object or an actual function and wraps it as a
   * `{ parse }` object with an optional post-processing step.
   */
  function wrapParser(parser, postprocess) {
    if (!parser) {
      return null;
    }

    postprocess = postprocess || Lazy.identity;

    var parseMethod = typeof parser === 'function' ?
      parser :
      parser.parse;

    return {
      parse: function() {
        return postprocess(parseMethod.apply(parser, arguments));
      }
    };
  }

  /**
   * Replaces, e.g., '{@link MyClass}' with '<a href="#MyClass">MyClass</a>'.
   */
  function processInternalLinks(html) {
    return html.replace(/\{@link ([^\}]*)}/g, function(string, match) {
      return '<a href="#' + match.replace(/[\.#]/g, '-') + '">' + match + '</a>';
    });
  }

  /**
   * Removes leading and trailing whitespace from a string.
   */
  function trim(string) {
    return string.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  /**
   * Splits a string into two parts on either side of a specified divider.
   */
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
