/**
 * Autodoc helps eliminate a lot of the gruntwork involved in creating a
 * JavaScript project. In particular it simplifies **writing and executing
 * tests**, **running performance benchmarks**, and **generating API
 * documentation**.
 */
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
        if (!node) {
          return;
        }

        if (fn(node) === false) {
          return false;
        }

        var children = Autodoc.getNodeChildren(node);

        if (children.length > 0) {
          return Lazy(children).nodes().each(fn);
        }
      });
    }
  });

  /**
   * An object responsible for parsing source code into an AST.
   *
   * @typedef {Object} Parser
   * @property {function(string):*} parse
   */

  /**
   * @typedef {Object} ExampleHandler
   * @property {RegExp} pattern
   * @property {function(Array.<string>, *):*} test
   */

  /**
   * An object responsible for rendering HTML templates. Autodoc currently
   * assumes a decidedly Mustache-like engine. Maybe someday this will be more
   * abstract, with adapters and whatnot.
   *
   * @typedef {Object} TemplateEngine
   * @property {function(string, Object):string} render
   */

  /**
   * All of the options Autodoc supports.
   *
   * @typedef {Object} AutodocOptions
   * @property {Parser|function(string):*} codeParser
   * @property {Parser|function(string):*} commentParser
   * @property {Parser|function(string):*} markdownParser
   * @property {Array.<string>} namespaces
   * @property {Array.<string>} tags
   * @property {string} grep
   * @property {Array.<string>} javascripts
   * @property {string} template
   * @property {TemplateEngine} templateEngine
   * @property {Object.<string, string>} templatePartials
   * @property {Array.<ExampleHandler>} exampleHandlers
   * @property {Object} extraOptions
   */

  /**
   * @constructor
   * @param {AutodocOptions=} options
   */
  function Autodoc(options) {
    options = Lazy(options || {})
      .defaults(Autodoc.options)
      .toObject();

    this.codeParser       = wrapParser(options.codeParser);
    this.commentParser    = wrapParser(options.commentParser);
    this.markdownParser   = wrapParser(options.markdownParser, Autodoc.processInternalLinks);
    this.highlighter      = options.highlighter;
    this.language         = options.language || 'javascript';
    this.compiler         = options.compiler[this.language];
    this.namespaces       = options.namespaces || [];
    this.tags             = options.tags || [];
    this.grep             = options.grep;
    this.javascripts      = options.javascripts || [];
    this.exampleHandlers  = options.exampleHandlers || [];
    this.template         = options.template;
    this.templateEngine   = options.templateEngine;
    this.templatePartials = options.templatePartials;
    this.extraOptions     = options.extraOptions || {};

    if (this.highlighter) {
      this.highlighter.loadMode(this.language);
    }
  }

  Autodoc.VERSION = '0.5.2';

  /**
   * Default Autodoc options. (See autodoc-node.js)
   */
  Autodoc.options = {};

  /**
   * An object describing a library, including its namespaces and custom types
   * as well as private/internal members.
   *
   * @typedef {Object} LibraryInfo
   * @property {string} name
   * @property {string} referenceName
   * @property {string} description
   * @property {string} code
   * @property {Array.<NamespaceInfo>} namespaces
   * @property {Array.<TypeInfo>} types
   * @property {Array.<FunctionInfo>} privateMembers
   */

  /**
   * Creates a Autodoc instance with the specified options and uses it to
   * parse the given code.
   *
   * @public
   * @param {string} code The JavaScript code to parse.
   * @param {AutodocOptions=} options
   * @returns {LibraryInfo}
   */
  Autodoc.parse = function(code, options) {
    return new Autodoc(options).parse(code);
  };

  /**
   * Creates a Autodoc instance with the specified options and uses it to
   * generate HTML documentation from the given code.
   *
   * @public
   * @param {LibraryInfo|string} source Either the already-parsed library data
   *     (from calling {@link #parse}), or the raw source code.
   * @param {AutodocOptions} options
   * @returns {string} The HTML for the library's API docs.
   */
  Autodoc.generate = function(source, options) {
    return new Autodoc(options).generate(source);
  };

  /**
   * Visits every node in an AST and assigns each a `parent` property, which
   * references the parent node in the structure of the AST.
   *
   * @param {Object} node The node in the AST to traverse.
   */
  Autodoc.assignParents = function(node) {
    var children = Autodoc.getNodeChildren(node);

    Lazy(children).compact().each(function(child) {
      child.parent = node;
      Autodoc.assignParents(child);
    });
  };

  /**
   * Returns an array of all the nodes directly underneath the current node in
   * an AST.
   *
   * @param {Object} node
   * @returns {Array.<*>} The node's direct children.
   */
  Autodoc.getNodeChildren = function(node) {
    switch (node.type) {
      case 'Program':
      case 'BlockStatement':
        return node.body;

      case 'FunctionDeclaration':
      case 'FunctionExpression':
        return [node.body];

      case 'IfStatement':
        return [node.consequent, node.alternate];

      case 'ForStatement':
      case 'ForInStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'LabeledStatement':
      case 'WithStatement':
        return [node.body];

      case 'SwitchStatement':
        return node.cases;

      case 'SwitchCase':
        return node.consequent;

      case 'ExpressionStatement':
        return [node.expression];

      case 'TryStatement':
        return [node.block];

      case 'AssignmentExpression':
        return [node.right];

      case 'CallExpression':
        return [node.callee].concat(node.arguments);

      case 'ConditionalExpression':
        return [node.consequent, node.alternate];

      case 'ObjectExpression':
        return node.properties;

      case 'ArrayExpression':
        return node.elements;

      case 'MemberExpression':
        return node.object.type === 'FunctionExpression' ? [node.object] : [];

      case 'NewExpression':
        return [node.callee];

      case 'UnaryExpression':
        return [node.argument];

      case 'BinaryExpression':
        return [node.left, node.right];

      case 'LogicalExpression':
        return [node.left, node.right];

      case 'SequenceExpression':
        return node.expressions;

      case 'Property':
        return [node.key, node.value];

      case 'VariableDeclaration':
        return node.declarations;

      case 'VariableDeclarator':
        return [node.init];

      // The basic idea here is that unless a node could POSSIBLY include
      // (potentially deep down somewhere) a function declaration/expression,
      // we'll treat it as having no children.
      case 'Literal':
      case 'Identifier':
      case 'UpdateExpression':
      case 'ThisExpression':
      case 'EmptyStatement':
      case 'ContinueStatement':
      case 'BreakStatement':
      case 'ReturnStatement':
      case 'ThrowStatement':
        return [];

      default:
        throw 'Unknown node type "' + node.type + '"\n' +
          'Data: ' + Autodoc.formatNode(node) + '\n\n' +
          'Report this to https://github.com/dtao/autodoc/issues';
    }
  };

  /**
   * Provides a useful string representation of a node.
   *
   * @param {Object} node
   * @returns {string}
   */
  Autodoc.formatNode = function(node) {
    var keys = Lazy(node).map(function(value, key) {
      return (value && value.type) ? (key + ':' + value.type) : key;
    });

    return node.type + ' (' + keys.join(', ') + ')';
  };

  /**
   * Parses an arbitrary blob of JavaScript code and returns an object
   * containing all of the data necessary to generate a project website with
   * docs, specs, and performance benchmarks.
   *
   * @param {string} code The JavaScript code to parse.
   * @returns {LibraryInfo}
   */
  Autodoc.prototype.parse = function(code) {
    var autodoc = this;

    // Compile the input code into something codeParser can parse. (For
    // JavaScript, this should just spit the same code right back out. For
    // CoffeeScript, it will compile it to JS then do a bit of post-processing
    // on it to ensure our AST-traversal and doclet-grouping stuff all still
    // works.)
    code = this.compiler.compile(code);

    // Generate the abstract syntax tree.
    var ast = this.codeParser.parse(code, {
      comment: true,
      loc: true,
      range: true
    });

    // Give each node a reference to its parent (useful).
    Autodoc.assignParents(ast);

    // This is kind of stupid... for now, I'm just assuming the library will
    // have a @fileOverview tag and @name tag in the header comments.
    var librarySummary = autodoc.getLibrarySummary(ast.comments);

    // Extract all of the functions from the AST, and map them to their location
    // in the code (this is so that we can associate each function with its
    // accompanying doc comments, if any).
    var functionsByLine = Lazy(ast.body).nodes()
      .filter(function(node) {
        return node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression';
      })
      .groupBy(function(node) { return node.loc.start.line; })
      .map(function(list, line) { return [line, list[0]]; })
      .toObject();

    // Go through all of of the comments in the AST, attempting to associate
    // each with a function.
    var functions = Lazy(ast.comments)
      .map(function(comment) {
        // Find the function right after this comment. If none exists, skip it.
        var fn = functionsByLine[comment.loc.end.line + 1];
        if (typeof fn === 'undefined') {
          return null;
        }

        // Attempt to parse the comment. If it can't be parsed, or it appears to
        // be basically empty, then skip it.
        var doc = autodoc.parseComment(comment);
        if (typeof doc === 'undefined') {
          return null;
        }

        return autodoc.createFunctionInfo(fn, doc, Autodoc.getFunctionSource(fn, code));
      })
      .compact()
      .toArray();

    // If no tags have been explicitly provided, but we find any occurrences of
    // the @public tag, we'll use that as a hint that only those methods tagged
    // @public should be included. Otherwise include everything.
    if (this.tags.length === 0) {
      if (Lazy(functions).any('isPublic')) {
        this.tags.push('public');
      }
    }

    // Only include documentation for functions with the specified tag(s), if
    // provided.
    if (this.tags.length > 0) {
      Lazy(functions).each(function(fn) {
        var hasTag = Lazy(autodoc.tags).any(function(tag) {
          return Lazy(fn.tags).contains(tag);
        });

        if (!hasTag) {
          fn.excludeFromDocs = true;
        }
      });
    }

    // Group by namespace so that we can keep the functions organized.
    var functionsByNamespace = Lazy(functions)
      .groupBy(function(fn) {
        return fn.isPrivate ? '[private]' : (fn.namespace || fn.shortName);
      })
      .toObject();

    // Only include specified namespaces, if the option has been provided.
    // Otherwise use all namespaces.
    if (this.namespaces.length === 0) {
      this.namespaces = Object.keys(functionsByNamespace).sort();
    }

    var namespaces = Lazy(this.namespaces)
      .map(function(namespace) {
        return Autodoc.createNamespaceInfo(functionsByNamespace, namespace);
      })
      .toArray();

    var privateMembers = Lazy(namespaces)
      .map('privateMembers')
      .flatten()
      .toArray();

    Lazy(privateMembers).each(function(member) {
      member.methods = Lazy(functions)
        .where({ namespace: member.shortName })
        .toArray();
    });

    // If there's a line that looks like:
    //
    //     module.exports = Foo;
    //
    // ...then we'll assume 'Foo' is the "reference name" of the library; i.e.,
    // the name conventionally used to refer to it within other libraries or
    // applications (like _ for Underscore, $ for jQuery, and so on).
    var nameFromModuleExports = Lazy(ast.body).nodes()
      .map(Autodoc.getModuleExportsIdentifier)
      .compact()
      .first();

    var referenceName = nameFromModuleExports;

    // If not, we'll guess that the first "namespace" that actually has members
    // is probably the conventional name.
    if (!referenceName) {
      var firstNonEmptyNamespace = Lazy(namespaces)
        .find(function(namespace) {
          return namespace.members.length > 0;
        });

      referenceName = firstNonEmptyNamespace ?
        firstNonEmptyNamespace.namespace.split('.').shift() :
        null;
    }

    var typeDefs = Lazy(ast.comments)
      .filter(function(comment) {
        return (/@typedef\b/).test(comment.value);
      })
      .map(function(comment) {
        var doc = autodoc.parseComment(comment);
        if (typeof doc === 'undefined') {
          return null;
        }

        if (!Lazy(doc.tags).any({ title: 'typedef' })) {
          return null;
        }

        return autodoc.createTypeInfo(doc);
      })
      .toArray();

    // TODO: Make this code a little more agnostic about the whole namespace
    // thing. I'm pretty sure there are plenty of libraries that don't use
    // this pattern at all.
    return {
      name: librarySummary.name || referenceName,
      referenceName: referenceName,
      description: librarySummary.description,
      code: code,
      namespaces: namespaces,
      docs: functions,
      privateMembers: privateMembers,
      types: typeDefs
    };
  };

  /**
   * Generates HTML for the API docs for the given library (as raw source code)
   * using the specified options, including templating library.
   *
   * @param {LibraryInfo|string} source Either the already-parsed library data
   *     (from calling {@link #parse}), or the raw source code.
   * @returns {string} The HTML for the library's API docs.
   */
  Autodoc.prototype.generate = function(source) {
    var libraryInfo = typeof source === 'string' ?
      this.parse(source) :
      source;

    // Decorate examples w/ custom handlers so that the template can be
    // populated differently for them.
    this.updateExamples(libraryInfo);

    // Additional stuff we want to tack on.
    libraryInfo.javascripts = this.javascripts;

    // If the grep option was provided, filter out all methods not matching the
    // specified pattern.
    var grep = this.grep;
    if (grep) {
      grep = new RegExp(grep);

      Lazy(libraryInfo.namespaces).each(function(namespace) {
        namespace.allMembers = Lazy(namespace.allMembers)
          .filter(function(member) {
            return grep.test(member.name);
          })
          .toArray();

        namespace.hasExamples = Lazy(namespace.allMembers).any('hasExamples');
      });

      libraryInfo.docs = Lazy(libraryInfo.docs)
        .filter(function(member) {
          return grep.test(member.name)
        })
        .toArray();
    }

    // Allow for arbitrary additional options, e.g. if the user wants to use
    // a custom template.
    var templateData = Lazy(libraryInfo)
      .extend(this.extraOptions)
      .toObject();

    // Finally pass our awesomely-finessed data to the template engine,
    // e.g., Mustache.
    return this.templateEngine.render(this.template, templateData, this.templatePartials);
  };

  /**
   * Iterates over all of the examples in the library and applies a callback to
   * each, along with its associated function name.
   *
   * @param {LibraryInfo} libraryInfo
   * @param {function(ExampleInfo, string):*} callback
   */
  Autodoc.prototype.eachExample = function(libraryInfo, callback) {
    Lazy(libraryInfo.docs)
      .each(function(doc) {
        Lazy(doc.examples.list).each(function(example) {
          callback(example, doc.name);
        });
      });
  };

  /**
   * Iterates over all of the examples in the library and tests whether each
   * should be handled by a custom handler. If so, marks it as such for
   * consumption by e.g. a template or a test runner.
   *
   * @param {LibraryInfo} libraryInfo
   */
  Autodoc.prototype.updateExamples = function(libraryInfo) {
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
    if (exampleHandlers.length === 0) {
      return;
    }

    var templateEngine   = this.templateEngine,
        templatePartials = this.templatePartials;

    this.eachExample(libraryInfo, function(example) {
      // Look at all of our examples. Those that are matched by some handler, we
      // will leave to be verified by handler.test, which will obviously need to
      // be available in the output HTML (bin/autodoc ensures this).
      Lazy(exampleHandlers).each(function(handler, i) {
        var match = example.expected.match(handler.pattern),
            data;

        if (match) {
          if (typeof handler.test === 'function') {
            // Mark this example as being handled
            example.hasCustomHandler = true;
            example.handlerIndex = i;

          } else if (typeof handler.template === 'string') {
            if (!templatePartials[handler.template]) {
              throw 'Template "' + handler.template + '" not defined.';
            }

            data = typeof handler.data === 'function' ?
              handler.data(match) : { match: match };

            example.exampleSource = templateEngine.render(
              templatePartials[handler.template],
              Lazy(example).extend(data).toObject()
            );

          } else {
            throw 'Custom example handlers must provide either a "test" function ' +
              'or a "template" name.';
          }

          // Exit early -- we found our handler!
          return false;
        }
      });
    });
  };

  /**
   * @typedef {Object} FunctionInfo
   * @property {string} name
   * @property {string} description
   * @property {boolean} isConstructor
   * @property {boolean} isStatic
   * @property {boolean} isPublic
   * @property {boolean} isPrivate
   * @property {boolean} hasSignature
   * @property {string} signature
   * @property {string} highlightedSignature
   * @property {boolean} hasExamples
   * @property {boolean} hasBenchmarks
   * @property {Array.<ParameterInfo>} params
   * @property {Array.<ReturnInfo>} returns
   * @property {ExampleCollection} examples
   * @property {BenchmarkCollection} benchmarks
   * @property {Array.<string>} tags
   * @property {string} source
   */

  /**
   * Takes a function node from the AST along with its associated doclet (from
   * parsing its comments) and generates an object with boatloads of data on it,
   * useful for passing to a templating system such as Mustache.
   *
   * @param {Object} fn
   * @param {Object} doc
   * @param {string} source
   * @returns {FunctionInfo}
   */
  Autodoc.prototype.createFunctionInfo = function(fn, doc, source) {
    var nameInfo    = Autodoc.parseName(Autodoc.getIdentifierName(fn) || '', doc),
        description = this.parseMarkdown(doc.description),
        params      = this.getParams(doc),
        returns     = this.getReturns(doc),
        isCtor      = Autodoc.hasTag(doc, 'constructor'),
        isStatic    = nameInfo.name.indexOf('#') === -1, // That's right, hacky smacky
        isPublic    = Autodoc.hasTag(doc, 'public'),
        isGlobal    = fn.parent.type === 'Program',
        isPrivate   = Autodoc.hasTag(doc, 'private'),
        signature   = Autodoc.getSignature(nameInfo, params),
        examples    = this.getExamples(doc),
        benchmarks  = this.getBenchmarks(doc),
        tags        = Lazy(doc.tags).pluck('title').toArray();

    return {
      name: nameInfo.name,
      shortName: nameInfo.shortName,
      longName: nameInfo.longName,
      identifier: nameInfo.identifier,
      namespace: nameInfo.namespace,
      description: description,
      params: params,
      returns: returns,
      isConstructor: isCtor,
      isGlobal: isGlobal,
      isStatic: isStatic,
      isPublic: isPublic,
      isPrivate: isPrivate,
      hasSignature: params.length > 0 || !!returns,
      signature: signature,
      highlightedSignature: this.highlightCode(signature),
      examples: examples,
      hasExamples: examples.list.length > 0,
      benchmarks: benchmarks,
      hasBenchmarks: benchmarks.list.length > 0,
      tags: tags,
      source: source
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
   * @param {string=} tagName The name of the tag to find (default: 'param').
   * @returns {Array.<ParameterInfo>} An array of { name, type, description }
   *     objects.
   */
  Autodoc.prototype.getParams = function(doc, tagName) {
    var self = this;

    return Lazy(doc.tags)
      .where({ title: tagName || 'param' })
      .map(function(tag) {
        return {
          name: tag.name,
          type: Autodoc.formatType(tag.type),
          description: self.parseMarkdown(tag.description || '')
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
  Autodoc.prototype.getReturns = function(doc) {
    var returnTag = Lazy(doc.tags).findWhere({ title: 'returns' });

    if (typeof returnTag === 'undefined') {
      return null;
    }

    return {
      type: Autodoc.formatType(returnTag.type),
      description: this.parseMarkdown(returnTag.description || '')
    };
  };

  /**
   * A custom type defined by a library.
   *
   * @typedef {object} TypeInfo
   * @property {string} name
   * @property {string} description
   * @property {Array.<PropertyInfo>} properties
   */

  /**
   * A property of a type defined by a {@link TypeInfo} object.
   *
   * @typedef {Object} PropertyInfo
   * @property {string} name
   * @property {string} type
   * @property {string} description
   */

  /**
   * Get a { name, properties } object representing a type defined w/ the
   * @typedef tag.
   */
  Autodoc.prototype.createTypeInfo = function(doc) {
    var description = doc.description,
        name = Autodoc.getTagDescription(doc, 'typedef'),
        properties = this.getParams(doc, 'property');

    return {
      name: name,
      identifier: name,
      description: this.parseMarkdown(description),
      properties: properties
    };
  };

  /**
   * High-level info about a library, namely its name and a brief description.
   *
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
  Autodoc.prototype.getLibrarySummary = function(comments) {
    var autodoc = this;

    var docs = Lazy(comments)
      .map(function(comment) {
        return autodoc.parseComment(comment);
      })
      .compact()
      .toArray();

    var docWithFileOverview = Lazy(docs)
      .filter(function(doc) {
        return Lazy(doc.tags).where({ title: 'fileOverview' }).any();
      })
      .first();

    var libraryName = '',
        libraryDesc = '';

    if (docWithFileOverview) {
      libraryDesc = Lazy(docWithFileOverview.tags).findWhere({ title: 'fileOverview' }).description;

      var libraryNameTag = Lazy(docWithFileOverview.tags).findWhere({ title: 'name' });
      if (libraryNameTag) {
        libraryName = libraryNameTag.description;
      }

    } else if (docs.length > 0) {
      libraryDesc = docs[0].description;
    }

    return {
      name: libraryName,
      description: this.parseMarkdown(libraryDesc)
    };
  };

  /**
   * Parses a comment.
   *
   * @param {string} comment The comment to parse.
   * @returns {Object}
   */
  Autodoc.prototype.parseComment = function(comment) {
    var value = comment.value;

    // I think I'm going crazy? For some reason I was originally wrapping
    // comments in /* and */ before parsing them with doctrine. Now it seems
    // that was never necessary and, in fact, just introduced ugliness with
    // CoffeeScript. So I'm completely reversing course, and REMOVING these
    // strings instead of introducing them. Seems to fix the issue.
    value = value.replace(/^\s*\/\*|\*\/\s*$/g, '');

    return this.commentParser.parse(value, { unwrap: true });
  };

  /**
   * Represents a single code example illustrating how a function works,
   * including an expectation as well as an actual (relative) source location.
   *
   * @typedef {Object} ExampleInfo
   * @property {number} id
   * @property {number} lineNumber
   * @property {string} actual
   * @property {string} actualEscaped
   * @property {string} expected
   * @property {string} expectedEscaped
   */

  /**
   * A collection of {@link ExampleInfo} objects, with an optional block of
   * setup code and some additional properties.
   *
   * @typedef {Object} ExampleCollection
   * @property {string} code
   * @property {string} highlightedCode
   * @property {string} setup
   * @property {Array.<ExampleInfo>} list
   */

  /**
   * Produces a { setup, examples } object providing some examples of a function.
   *
   * @param {Object} doc
   * @returns {ExampleCollection}
   */
  Autodoc.prototype.getExamples = function(doc) {
    var self = this,
        exampleIdCounter = 1;

    return Autodoc.parseCommentLines(doc, ['examples', 'example'], function(data) {
      return {
        code: data.content,
        highlightedCode: self.highlightCode(data.content),
        setup: self.compileSnippet(data.preamble),
        list: Lazy(data.pairs).map(function(pair) {
          return {
            id: exampleIdCounter++,
            lineNumber: pair.lineNumber,
            actual: self.compileSnippet(pair.left),
            actualEscaped: Autodoc.escapeJsString(pair.left),
            expected: pair.right,
            expectedEscaped: Autodoc.escapeJsString(pair.right)
          };
        }).toArray()
      };
    });
  };

  /**
   * Represents a single benchmark case.
   *
   * @typedef {Object} BenchmarkCase
   * @property {number} caseId
   * @property {string} impl
   * @property {string} name
   * @property {string} label
   */

  /**
   * Represents a performance benchmark, which should illustrate a single piece
   * of functionality with one or more *cases* to compare different
   * implementations.
   *
   * @typedef {Object} BenchmarkInfo
   * @property {number} id
   * @property {string} name
   * @property {Array.<BenchmarkCase>} cases
   */

  /**
   * A collection of {@link BenchmarkInfo} objects, each of which illustrates a
   * single piece of functionality with one or more cases each.
   *
   * @typedef {Object} BenchmarkCollection
   * @property {string} code
   * @property {string} highlightedCode
   * @property {string} setup
   * @property {Array.<BenchmarkInfo>} list
   */

  /**
   * Produces a { setup, benchmarks } object providing some benchmarks for a function.
   *
   * @param {Object} doc
   * @returns {BenchmarkCollection}
   */
  Autodoc.prototype.getBenchmarks = function(doc) {
    var self = this,
        benchmarkCaseIdCounter = 1,
        benchmarkIdCounter     = 1;

    return Autodoc.parseCommentLines(doc, 'benchmarks', function(data) {
      var benchmarks = Lazy(data.pairs)
        .map(function(pair) {
          var parts = divide(pair.right, ' - ');

          return {
            caseId: benchmarkCaseIdCounter++,
            impl: self.compileSnippet(pair.left),
            name: parts[0],
            label: parts[1] || 'Ops/second'
          };
        })
        .groupBy('name')
        .map(function(cases, name) {
          return {
            id: benchmarkIdCounter++,
            name: name,
            cases: cases
          }
        })
        .toArray();

      return {
        code: data.content,
        highlightedCode: self.highlightCode(data.content),
        setup: self.compileSnippet(data.preamble),
        list: benchmarks,
        cases: benchmarks.length > 0 ? benchmarks[0].cases : []
      };
    });
  };

  /**
   * Does syntax highlighting on a bit of code.
   */
  Autodoc.prototype.highlightCode = function(code) {
    var highlighter = this.highlighter;

    var highlightedCode = (highlighter && typeof highlighter.highlight === 'function') ?
      highlighter.highlight(code, { mode: this.language }) :
      code;

    // Wrap each line in a <span> including the line number.
    return Lazy(highlightedCode)
      .split('\n')
      .map(function(line, i) {
        return '<span class="line" data-line-no="' + i + '">' + line + '</span>';
      })
      .join('\n');
  };

  /**
   * Parses Markdown + does syntax highlighting (maybe).
   */
  Autodoc.prototype.parseMarkdown = function(markdown) {
    var self = this;

    return this.markdownParser.parse(markdown, {
      gfm: true,
      highlight: function(code) {
        return self.highlightCode(code);
      }
    });
  };

  /**
   * Compiles just a little snippet of code.
   */
  Autodoc.prototype.compileSnippet = function(code) {
    return trim(this.compiler.compile(code, { bare: true }));
  };

  /**
   * Gets the name of whatever identifier is associated with this node (if any).
   *
   * @param {Object} object
   * @return {Object}
   */
  Autodoc.getIdentifierName = function(node, alreadyVisited) {
    if (!node) {
      return null;
    }

    // Little one-off array-based set implementation. Because... I just felt
    // like doing it this way.
    alreadyVisited = alreadyVisited || (function() {
      var nodes = [];

      return {
        include: function(node) {
          nodes.push(node);
        },

        includes: function(node) {
          for (var i = 0; i < nodes.length; ++i) {
            if (nodes[i] === node) {
              return true;
            }
          }
          return false;
        }
      };
    }());

    if (alreadyVisited.includes(node)) {
      return null;
    }
    alreadyVisited.include(node);

    switch (node.type) {
      case 'Identifier':
        return node.name;

      case 'FunctionDeclaration':
        return Autodoc.getIdentifierName(node.id, alreadyVisited);

      case 'AssignmentExpression':
        return Autodoc.getIdentifierName(node.left, alreadyVisited);

      case 'MemberExpression':
        if (node.parent && node.parent.type !== 'AssignmentExpression') {
          return null;
        }

        return (
          Autodoc.getIdentifierName(node.object, alreadyVisited) + '.' +
          (node.computed ? node.property.value : Autodoc.getIdentifierName(node.property, alreadyVisited))
        ).replace(/\.prototype\./, '#');

      case 'Property':
        return Autodoc.getIdentifierName(node.parent, alreadyVisited) + '.' +
          Autodoc.getIdentifierName(node.key, alreadyVisited);

      case 'FunctionExpression':
        return Autodoc.getIdentifierName(node.parent, alreadyVisited);

      case 'VariableDeclarator':
        return Autodoc.getIdentifierName(node.id, alreadyVisited);

      case 'ExpressionStatement':
        return Autodoc.getIdentifierName(node.expression, alreadyVisited);

      default:
        return Autodoc.getIdentifierName(node.parent, alreadyVisited);
    }
  };

  /**
   * Contains various representations (e.g., short, full) of the *name* of a
   * function.
   *
   * @typedef {Object} NameInfo
   * @property {string} name
   * @property {string} shortName
   * @property {string} longName
   * @property {string} namespace
   * @property {string} identifier
   */

  /**
   * Takes, e.g., 'Foo#bar' and returns a { name, shortName, namespace,
   * identifier} object.
   *
   * @public
   * @param {string} name
   * @param {FunctionInfo=} doc
   * @returns {NameInfo}
   *
   * @examples
   * Autodoc.parseName('Foo#bar').name           // => 'Foo#bar'
   * Autodoc.parseName('Foo#bar').shortName      // => 'bar'
   * Autodoc.parseName('Foo.Bar#baz').namespace  // => 'Foo.Bar'
   * Autodoc.parseName('Foo#bar').identifier     // => 'Foo-bar'
   * Autodoc.parseName('Foo.Bar#baz').identifier // => 'Foo-Bar-baz'
   * Autodoc.parseName('Foo').name               // => 'Foo'
   * Autodoc.parseName('Foo').identifier         // => 'Foo'
   * Autodoc.parseName('Foo').namespace          // => null
   */
  Autodoc.parseName = function(name, fn) {
    var parts = name.split(/[\.#]/),

        // e.g., the short name for 'Lib.utils.func' should be 'func'
        shortName = parts.pop(),

        // keep the long name too, for e.g. regurgitating it back in a template
        // (this is what we do w/ elevating private members)
        // YES, I realize this is just reversing what already happened in
        // getIdentifierName. I haven't really thought that hard about the right
        // approach there. (I wrote the rest of this code a little while ago --
        // by which I mean like just a few days, but that might as well be
        // forever -- and so I don't really remember what assumptions I had in
        // my head at the time. SO, I will do this stupid thing for now and
        // leave this obscenely long comment here to shame myself into one day
        // circling back and fixing it. Or, nobody will ever notice this and
        // I'll totally get away with it.
        //
        // You know what? If you're reading this, create an issue:
        // https://github.com/dtao/autodoc/issues/new
        //
        // How's that?
        longName  = name.replace(/#/, '.prototype.'),

        // a name like 'foo#bar#baz' wouldn't make sense; so we can safely join
        // w/ '.' to recreate the namespace
        namespace = parts.join('.');

    if (fn) {
      // Actually, if this function is tagged @global, then it doesn't belong to
      // a namespace.
      if (Autodoc.hasTag(fn, 'global')) {
        namespace = '';
        name = shortName;

      // On the other hand, if it's tagged @memberOf, then we want to use that
      // tag for its explicit namespace. (We'll assume static members unless the
      // @instance tag is present.)
      } else if (Autodoc.hasTag(fn, 'memberOf')) {
        namespace = Autodoc.getTagDescription(fn, 'memberOf');
        name = namespace + ((fn && Autodoc.hasTag(fn, 'instance')) ? '#' : '.') +
          shortName;
      }
    }

    return {
      name: name,
      shortName: shortName,
      longName: longName,
      namespace: namespace || null,
      identifier: name.replace(/[\.#]/g, '-')
    };
  };

  /**
   * Simply determines whether a doc has a tag or doesn't.
   *
   * @public
   * @param {Object} doc The doclet to check.
   * @param {string} tagName The tag name to look for.
   * @returns {boolean} Whether or not the doclet has the tag.
   */
  Autodoc.hasTag = function(doc, tagName) {
    return !!Lazy(doc.tags).findWhere({ title: tagName });
  };

  /**
   * Produces a string representing the signature of a function.
   *
   * @param {NameInfo} name
   * @param {Array.<ParameterInfo>} params
   * @returns {string}
   */
  Autodoc.getSignature = function(name, params) {
    var formattedParams = '(' + Lazy(params).pluck('name').join(', ') + ')',
        signature;

    if (name.name === name.shortName) {
      signature = 'function ' + name.shortName + formattedParams;
    } else {
      signature = name.namespace + '.' + name.shortName + ' = function' + formattedParams;
    }

    return signature + ' { /*...*/ }';
  };

  /**
   * Represents an abstract left/right pair, which can be used e.g. as the basis
   * for an {@link ExampleInfo}.
   *
   * @typedef PairInfo
   * @property {number} lineNumber
   * @property {string} left
   * @property {string} right
   */

  /**
   * @callback DataCallback
   * @param {{preamble:string, pairs:Array.<PairInfo>}} data
   * @returns {*}
   */

  /**
   * Takes a doclet and a tag name (or list of tag names), then reads all of the
   * lines from that tag and splits them across '=>', finally calling a callback
   * on each left/right pair. (Does that make any sense? Whatever.)
   *
   * @param {Object} doc
   * @param {string|string[]} tagNames
   * @param {DataCallback} callback
   * @returns {Array.<*>} An array of whatever the callback returns.
   */
  Autodoc.parseCommentLines = function(doc, tagNames, callback) {
    var comment      = Autodoc.getTagDescription(doc, tagNames),
        commentLines = comment.split('\n'),
        initialLines = [],
        pairs        = [];

    Lazy(commentLines)
      .each(function(line, i) {
        var pair = Autodoc.parsePair(line);

        if (!pair && pairs.length === 0) {
          initialLines.push(line);

        } else if (pair) {
          if (!pair.left) {
            pair.left = (pairs.length > 0 ? commentLines[i - 1] : initialLines.pop()) || '';
          }

          pair.lineNumber = i;
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
   * @param {string|string[]} tagNames
   * @returns {string}
   */
  Autodoc.getTagDescription = function(doc, tagNames) {
    var tag;

    if (!(tagNames instanceof Array)) {
      tagNames = [tagNames];
    }

    for (var i = 0, len = tagNames.length; !tag && (i < len); ++i) {
      tag = Lazy(doc.tags).findWhere({ title: tagNames[i] });
    }

    if (typeof tag === 'undefined') {
      return '';
    }

    return tag.description;
  };

  /**
   * Given a line like 'left // => right', parses this into a { left, right }
   * pair. Trims leading and trailing whitespace around both parts. The '=>'
   * part is optional.
   *
   * @public
   * @param {string} line
   * @returns {PairInfo|null}
   *
   * @examples
   * Autodoc.parsePair('foo(bar)//=>5')      // => { left: 'foo(bar)', right: '5' }
   * Autodoc.parsePair(' bar(baz) //=> 10 ') // => { left: 'bar(baz)', right: '10' }
   * Autodoc.parsePair('foo // => bar')      // => { left: 'foo', right: 'bar' }
   * Autodoc.parsePair('foo // bar')         // => { left: 'foo', right: 'bar' }
   * Autodoc.parsePair('// => 5')            // => { left: '', right: '5' }
   * Autodoc.parsePair('// bar')             // => null
   * Autodoc.parsePair('foo //')             // => null
   */
  Autodoc.parsePair = function(line) {
    var parts = line.match(/^\s*(.*)\s*\/\/\s*(=>)?\s*([^\s].*)$/);

    if (!parts) {
      return null;
    }

    // The => is only optional for single-line pairs.
    if (!parts[1] && !parts[2]) {
      return null;
    }

    return {
      left: trim(parts[1]),
      right: trim(parts[3])
    };
  };

  /**
   * Produces a string representation of a type object.
   *
   * @param {Object} type
   * @returns {string}
   */
  Autodoc.formatType = function(type) {
    if (!type) { return '*'; }

    switch (type.type) {
      case 'NameExpression':
        return type.name;

      case 'AllLiteral':
        return '*';

      case 'NullLiteral':
        return 'null';

      case 'TypeApplication':
        return Autodoc.formatType(type.expression) + '.<' + Lazy(type.applications).map(Autodoc.formatType).join('|') + '>';

      case 'RecordType':
        return '{' + Lazy(type.fields).map(function(field) {
          return field.key + ':' + Autodoc.formatType(field.value);
        }).join(', ');

      case 'OptionalType':
        return Autodoc.formatType(type.expression) + '?';

      case 'UnionType':
        return Lazy(type.elements).map(Autodoc.formatType).join('|');

      case 'RestType':
        return '...' + Autodoc.formatType(type.expression);

      case 'FunctionType':
        return 'function(' + Lazy(type.params).map(Autodoc.formatType).join(', ') + '):' + Autodoc.formatType(type.result);

      case 'ArrayType':
        return type.elements;

      case 'NullableType':
        return '?' + Autodoc.formatType(type.expression);

      default:
        throw 'Unable to format type ' + type.type + '!\n\n' + JSON.stringify(type, null, 2);
    }
  };

  /**
   * Represents a bunch of information about a *namespace*, which is either a
   * function or an object with multiple members, forming one of the larger
   * pieces of a library.
   *
   * @typedef {Object} NamespaceInfo
   * @property {string} namespace
   * @property {FunctionInfo} constructorMethod
   * @property {Array.<FunctionInfo>} members
   * @property {Array.<FunctionInfo>} privateMembers
   * @property {Array.<FunctionInfo>} allMembers
   * @property {boolean} hasExamples
   * @property {boolean} hasBenchmarks
   */

  /**
   * Finds all of the functions in a library belonging to a certain namespace
   * and creates a {@link NamespaceInfo} object from each, with members sorted
   * in a UI-friendly order.
   *
   * @public
   * @param {Object.<string, Array.<FunctionInfo>>} docs
   * @param {string} namespace
   * @returns {NamespaceInfo}
   */
  Autodoc.createNamespaceInfo = function(docs, namespace) {
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
    var allMembers = Lazy([constructorMethod])
      .concat(members)
      .compact()
      .toArray();

    // Private members can be elevated to some visible scope when running tests.
    var privateMembers = Lazy(allMembers)
      .filter('isPrivate')
      .sortBy('name')
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
      privateMembers: privateMembers,
      allMembers: allMembers,
      hasExamples: Lazy(allMembers).any('hasExamples'),
      hasBenchmarks: Lazy(allMembers).any('hasBenchmarks'),
      excludeFromDocs: (namespace === '[private]') || Lazy(allMembers).all('excludeFromDocs')
    };
  };

  /**
   * Replaces JsDoc references like '{@link MyClass}' with actual HTML links.
   *
   * @param {string} html
   * @returns {string} The HTML with JsDoc `@link` references replaced by links.
   *
   * @examples
   * Autodoc.processInternalLinks('{@link MyClass}') // => '<a href="#MyClass">MyClass</a>'
   */
  Autodoc.processInternalLinks = function(html) {
    return html.replace(/\{@link ([^\}]*)}/g, function(string, match) {
      return '<a href="#' + match.replace(/[\.#]/g, '-') + '">' + match + '</a>';
    });
  };

  /**
   * Checks whether an AST node is a line like:
   *
   *     module.exports = Foo;
   *
   * @param {Object} node The AST node to check.
   * @returns {string=} If `node` assigns some identifier to `module.exports`,
   *     then the name of that identifier. Otherwise `null`.
   */
  Autodoc.getModuleExportsIdentifier = function(node) {
    if (node.type !== 'AssignmentExpression') {
      return null;
    }

    if (node.left.type !== 'MemberExpression') {
      return null;
    }

    var object     = node.left.object,
        property   = node.left.property,
        identifier = node.right;

    if (!Lazy([object, property, identifier]).all({ type: 'Identifier' })) {
      return null;
    }

    if (object.name !== 'module' || property.name !== 'exports') {
      return null;
    }

    return identifier.name;
  };

  /**
   * Given an AST node representing some function and the associated library
   * code, returns just the code for the function.
   *
   * @param {Object} node The AST node.
   * @param {string} code The source code for the associated library.
   * @return {string} Just the source code for the function itself.
   */
  Autodoc.getFunctionSource = function(node, code) {
    return String.prototype.substring.apply(code, node.range);
  };

  /**
   * Provides an escaped form of a string to facilitate dropping it "unescaped"
   * (aside from this, of course) directly into a JS template. Basically,
   * escapes single quotes, double quotes, newlines, and backslashes.
   *
   * @public
   * @param {string} string
   * @returns {string}
   *
   * @examples
   * Autodoc.escapeJsString('foo')                      // => 'foo'
   * Autodoc.escapeJsString("Hell's Kitchen")           // => "Hell\\'s Kitchen"
   * Autodoc.escapeJsString('Dan "The Man"')            // => 'Dan \\"The Man\\"'
   * Autodoc.escapeJsString('line 1\nline 2')           // => 'line 1\\nline 2'
   * Autodoc.escapeJsString('foo\\bar')                 // => 'foo\\\\bar'
   * Autodoc.escapeJsString('dir\\"other dir"\\Moe\'s') // => 'dir\\\\\\"other dir\\"\\\\Moe\\\'s'
   */
  Autodoc.escapeJsString = function(string) {
    return string.replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  };

  /**
   * Removes leading and trailing whitespace from a string.
   *
   * @private
   * @param {string} string The string to trim.
   * @returns {string} The trimmed result.
   *
   * @examples
   * trim('foo')                 // => 'foo'
   * trim('  foo')               // => 'foo'
   * trim('foo  ')               // => 'foo'
   * trim('  foo  ')             // => 'foo'
   * trim(' \t\n\r foo \r\n\t ') // => 'foo'
   *
   * @benchmarks
   * trim('foo')        // no trimming necessary
   * trim('   foo    ') // trimming necessary
   */
  function trim(string) {
    return string.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  /**
   * Splits a string into two parts on either side of a specified divider.
   *
   * @private
   * @param {string} string The string to divide into two parts.
   * @param {string} divider The string used as the pivot point.
   * @returns {Array.<string>} The parts of the string before and after the
   *     first occurrence of `divider`, or a 1-element array containing `string`
   *     if `divider` wasn't found.
   *
   * @examples
   * divide('hello', 'll')   // => ['he', 'o']
   * divide('banana', 'n')   // => ['ba', 'ana']
   * divide('a->b->c', '->') // => ['a', 'b->c']
   * divide('foo', 'xyz')    // => ['foo']
   * divide('abc', 'abc')    // => ['', '']
   */
  function divide(string, divider) {
    var seam = string.indexOf(divider);
    if (seam === -1) {
      return [string];
    }

    return [string.substring(0, seam), string.substring(seam + divider.length)];
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Autodoc;

  } else {
    context.Autodoc = Autodoc;
  }

}(typeof global !== 'undefined' ? global : this));
