/**
 * Autodoc helps eliminate a lot of the gruntwork involved in creating a
 * JavaScript project. In particular it simplifies **writing and executing
 * tests**, **running performance benchmarks**, and **generating API
 * documentation**.
 */
(function(context) {

  var Lazy      = context.Lazy,
      Spiderman = context.Spiderman;

  // Auto-require dependencies if they aren't already defined and we're in Node.
  if (typeof Lazy === 'undefined' && typeof require === 'function') {
    Lazy = require('lazy.js');
  }
  if (typeof Spiderman === 'undefined' && typeof require === 'function') {
    Spiderman = require('spiderman');
  }

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
    this.exampleHandlers  = exampleHandlers(options.exampleHandlers);
    this.template         = options.template;
    this.templateEngine   = options.templateEngine;
    this.templatePartials = options.templatePartials;
    this.extraOptions     = options.extraOptions || {};
    this.errors           = [];

    if (this.highlighter) {
      this.highlighter.loadMode(this.language);
    }
  }

  Autodoc.VERSION = '0.5.6';

  /**
   * Default Autodoc options. (See autodoc-node.js)
   */
  Autodoc.options = {};

  /**
   * Represents an error encountered by Autodoc.
   *
   * @public @typedef {Object} ErrorInfo
   * @property {string} stage
   * @property {string} message
   * @property {number} line
   */

  /**
   * An object describing a library, including its namespaces and custom types
   * as well as private/internal members.
   *
   * @public @typedef {Object} LibraryInfo
   * @property {string} name
   * @property {string} referenceName
   * @property {string} description
   * @property {string} code
   * @property {Array.<NamespaceInfo>} namespaces
   * @property {boolean} hasTypes
   * @property {Array.<TypeInfo>} types
   * @property {Array.<FunctionInfo>} privateMembers
   * @property {string} exampleHelpers
   * @property {Array.<ErrorInfo>} errors
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

    // This is kind of stupid... for now, I'm just assuming the library will
    // have a @fileOverview tag and @name tag in the header comments.
    var librarySummary = autodoc.getLibrarySummary(ast.comments);

    // Extract all of the functions from the AST, and map them to their location
    // in the code (this is so that we can associate each function with its
    // accompanying doc comments, if any).
    var functionsByLine = Lazy(Spiderman(ast).descendents())
      .filter(function(node) {
        return node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression';
      })
      .groupBy(function(node) { return node.unwrap().loc.start.line; })
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
        if (!doc) {
          return null;
        }

        // This will be useful later.
        comment.lines = comment.value.split('\n');

        return autodoc.createFunctionInfo(fn, doc, comment, Autodoc.getFunctionSource(fn.unwrap(), code));
      })
      .compact()
      .toArray();

    // Also identify all of the comments that define custom types w/ the
    // `@typedef` tag.
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

    // Only include documentation for functions/types with the specified tag(s),
    // if provided.
    if (this.tags.length > 0) {
      Lazy(functions).concat(typeDefs).each(function(functionOrType) {
        var hasTag = Lazy(autodoc.tags).any(function(tag) {
          return Lazy(functionOrType.tags).contains(tag);
        });

        if (!hasTag) {
          functionOrType.excludeFromDocs = true;
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
      .reject(function(member) {
        return !member.shortName;
      })
      .toArray();

    Lazy(privateMembers).each(function(member, i) {
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
    var nameFromModuleExports = Lazy(Spiderman(ast).descendents())
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

    // See if there's a comment somewhere w/ the @exampleHelpers tag; if so,
    // we'll supply that code to all examples.
    var exampleHelpers = Lazy(ast.comments)
      .filter(function(comment) {
        return (/@exampleHelpers\b/).test(comment.value);
      })
      .map(function(comment) {
        var doc = autodoc.parseComment(comment);
        if (typeof doc === 'undefined') {
          return null;
        }

        return Autodoc.getTagDescriptions(doc, 'exampleHelpers');
      })
      .flatten()
      .compact()
      .first() || '';

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
      hasTypes: !Lazy(typeDefs).all('excludeFromDocs'),
      types: typeDefs,
      exampleHelpers: exampleHelpers,
      errors: this.errors
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
        Lazy(doc.examples).pluck('list').flatten().each(function(example) {
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
        templatePartials = this.templatePartials,
        codeParser       = this.codeParser;

    var brokenExamples = [];

    this.eachExample(libraryInfo, function(example) {
      // Look at all of our examples. Those that are matched by some handler, we
      // will leave to be verified by handler.test, which will obviously need to
      // be available in the output HTML (bin/autodoc ensures this).
      var matchingHandler = Lazy(exampleHandlers).any(function(handler, i) {
        var match = example.expected.match(handler.pattern),
            data;

        if (match) {
          if (typeof handler.template === 'string') {
            if (!(handler.template in templatePartials)) {
              throw 'Template "' + handler.template + '" not defined.';
            }

            data = { match: match };

            if (typeof handler.data === 'function') {
              data = handler.data(match);

              // Yes, this could potentially override a property like
              // 'whateverEscaped'... I don't care about that right now. Easy to
              // fix later.
              Lazy(Object.keys(data)).each(function(key) {
                data[key + 'Escaped'] = Autodoc.escapeJsString(data[key]);
              });
            }

            example.exampleSource = templateEngine.render(
              templatePartials[handler.template],
              Lazy(example).extend(data).toObject()
            ) || '// pending';

          } else {
            throw 'Custom example handlers must provide a template name.';
          }

          // Exit early -- we found our handler!
          return true;
        }
      });

      if (!matchingHandler) {
        // In case there's no custom handler defined for this example, let's
        // ensure that it's at least valid JavaScript. If not, that's a good
        // indicator there SHOULD be a custom handler defined for it!
        try {
          codeParser.parse(
            'var actual = ' + example.actual + '\n' +
            'var expected = ' + example.expected
          );

        } catch (e) {
          brokenExamples.push({
            example: example,
            error: e
          });
        }
      }
    });

    if (brokenExamples.length > 0) {
      console.error("\n\x1B[33mThe following examples don't match any custom handlers, " +
        "and they aren't valid JavaScript:'\x1B[39m\n");

      Lazy(brokenExamples).each(function(data) {
        var example = data.example,
            error = data.error;

        var offendingLine = error.lineNumber;

        console.error(withLineNumbers(example.actual + '\n' + example.expected, offendingLine));
        console.error('\x1B[31m' + error + '\x1B[39m');

        // Mark the example as broken so we don't run it.
        example.broken = true;
      });

      console.error("\nYou can define custom handlers in a 'handlers.js' file " +
        "(or specify with the --handlers option), like this:\n");

      console.error([
        'this.exampleHandlers = [',
        '  {',
        '    pattern: /pattern to match/',
        '    template: "name of template"',
        '  }',
        '  ...',
        '];'
      ].join('\n'));

      console.error('\nSee the README at ' +
        '\x1B[36mhttps://github.com/dtao/autodoc/blob/master/README.md\x1B[39m ' +
        'for more details.\n');
    }
  };

  /**
   * @public
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
   * @property {string} highlightedSource
   */

  /**
   * Takes a function node from the AST along with its associated doclet (from
   * parsing its comments) and generates an object with boatloads of data on it,
   * useful for passing to a templating system such as Mustache.
   *
   * @param {Object} fn
   * @param {Object} doc
   * @param {Object} comment
   * @param {string} source
   * @returns {FunctionInfo}
   */
  Autodoc.prototype.createFunctionInfo = function(fn, doc, comment, source) {
    var nameInfo    = Autodoc.parseName(fn.inferName() || '', doc),
        description = this.parseMarkdown(doc.description),
        params      = this.getParams(doc),
        returns     = this.getReturns(doc),
        isCtor      = Autodoc.hasTag(doc, 'constructor'),
        isStatic    = nameInfo.name.indexOf('#') === -1, // That's right, hacky smacky
        isPublic    = Autodoc.hasTag(doc, 'public'),
        isGlobal    = fn.parent.type === 'Program',
        isPrivate   = Autodoc.hasTag(doc, 'private'),
        signature   = Autodoc.getSignature(nameInfo, params),
        examples    = this.getExamples(doc, comment),
        benchmarks  = this.getBenchmarks(doc, comment),
        tags        = Lazy(doc.tags).pluck('title').toArray();

    // Do you guys know what I'm talking about? I don't. -Mitch Hedberg
    if (nameInfo.name !== nameInfo.shortName) {
      source = nameInfo.namespace + '.' + nameInfo.shortName + ' = ' + source;
    }

    return {
      name: nameInfo.name,
      shortName: nameInfo.shortName,
      longName: nameInfo.longName,
      lowerCaseName: nameInfo.shortName.toLowerCase(),
      searchName: hyphenate(nameInfo.shortName),
      acronym: acronym(nameInfo.name),
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
      highlightedSignature: insertSignatureLink(this.highlightCode(signature), nameInfo.identifier),
      examples: examples,
      hasExamples: examples.length > 0,
      benchmarks: benchmarks,
      hasBenchmarks: benchmarks.length > 0,
      tags: tags,
      source: source,
      highlightedSource: this.highlightCode(source)
    };
  };

  /**
   * @typedef {Object} ParameterInfo
   * @public
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
   * @public
   * @property {string} name
   * @property {string} description
   * @property {Array.<PropertyInfo>} properties
   * @property {Array.<string>} tags
   */

  /**
   * A property of a type defined by a {@link TypeInfo} object.
   *
   * @typedef {Object} PropertyInfo
   * @public
   * @property {string} name
   * @property {string} type
   * @property {string} description
   */

  /**
   * Get a { name, properties } object representing a type defined w/ the
   * `@typedef` tag.
   */
  Autodoc.prototype.createTypeInfo = function(doc) {
    var description = doc.description,
        names       = Autodoc.getTagDescriptions(doc, 'typedef')
        properties  = this.getParams(doc, 'property'),
        tags        = Lazy(doc.tags).pluck('title').toArray();

    var name = names[0] || '';

    return {
      name: name,
      identifier: 'type-' + name,
      lowerCaseName: name.toLowerCase(),
      searchName: hyphenate(name),
      acronym: acronym(name),
      description: this.parseMarkdown(description),
      properties: properties,
      tags: tags
    };
  };

  /**
   * High-level info about a library, namely its name and a brief description.
   *
   * @typedef {Object} LibrarySummary
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

    var libraryNameTag,
        libraryName = '',
        libraryDesc = '';

    if (docWithFileOverview) {
      libraryDesc = Lazy(docWithFileOverview.tags).findWhere({ title: 'fileOverview' }).description;

      libraryNameTag = Lazy(docWithFileOverview.tags).findWhere({ title: 'name' });
      if (libraryNameTag) {
        libraryName = libraryNameTag.description;
      }

    } else if (docs.length > 0) {
      libraryNameTag = Lazy(docs[0].tags).findWhere({ title: 'name' });
      if (libraryNameTag) {
        libraryName = libraryNameTag.description;
      }

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
   * @param {Object} comment The comment to parse.
   * @returns {Object?}
   */
  Autodoc.prototype.parseComment = function(comment) {
    var value = comment.value;

    // I think I'm going crazy? For some reason I was originally wrapping
    // comments in /* and */ before parsing them with doctrine. Now it seems
    // that was never necessary and, in fact, just introduced ugliness with
    // CoffeeScript. So I'm completely reversing course, and REMOVING these
    // strings instead of introducing them. Seems to fix the issue.
    value = value.replace(/^\s*\/\*|\*\/\s*$/g, '');

    try {
      return this.commentParser.parse(value, { unwrap: true, lineNumbers: true });

    } catch (e) {
      this.errors.push({
        stage: 'parsing comment',
        line: comment.loc.start.line,
        message: String(e.message || e)
      });

      return null;
    }
  };

  /**
   * Represents a single code example illustrating how a function works,
   * including an expectation as well as an actual (relative) source location.
   *
   * @typedef {Object} ExampleInfo
   * @public
   * @property {number} id
   * @property {number} relativeLine
   * @property {number} absoluteLine
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
   * @public
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
  Autodoc.prototype.getExamples = function(doc, comment) {
    var self = this,
        exampleIdCounter = 1;

    return this.parseCommentLines(doc, comment.lines, ['examples', 'example'], function(data) {
      return {
        code: data.content,
        highlightedCode: self.highlightCode(data.content),
        setup: self.compileSnippet(data.preamble),
        list: Lazy(data.pairs).map(function(pair) {
          // Snip out any leading 'var x = ' before the actual expression.
          // Why? Because this is going to get injected into a template, and
          // we don't want to have 'var result = var x = '.
          //
          // To be fair, there's probably a better approach. I'll leave figuring
          // that out as an exercise to my future self.
          var actual   = removeVar(pair.left),
              expected = pair.right;

          return {
            id: exampleIdCounter++,
            relativeLine: pair.lineNumber,
            absoluteLine: comment.loc.start.line + data.lineNumber + pair.lineNumber,
            actual: self.compileSnippet(actual),
            actualEscaped: Autodoc.escapeJsString(actual),
            expected: expected,
            expectedEscaped: Autodoc.escapeJsString(expected)
          };
        }).toArray()
      };
    });
  };

  /**
   * Represents a single benchmark case.
   *
   * @typedef {Object} BenchmarkCase
   * @public
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
   * @public
   * @property {number} id
   * @property {string} name
   * @property {Array.<BenchmarkCase>} cases
   */

  /**
   * A collection of {@link BenchmarkInfo} objects, each of which illustrates a
   * single piece of functionality with one or more cases each.
   *
   * @typedef {Object} BenchmarkCollection
   * @public
   * @property {string} code
   * @property {string} highlightedCode
   * @property {string} setup
   * @property {Array.<BenchmarkInfo>} list
   */

  /**
   * Produces a { setup, benchmarks } object providing some benchmarks for a function.
   *
   * @param {Object} doc
   * @param {Object} comment
   * @returns {BenchmarkCollection}
   */
  Autodoc.prototype.getBenchmarks = function(doc, comment) {
    var self = this,
        benchmarkCaseIdCounter = 1,
        benchmarkIdCounter     = 1;

    return this.parseCommentLines(doc, comment.lines, 'benchmarks', function(data) {
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

    try {
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

    } catch (e) {
      this.errors.push({
        stage: 'syntax highlighting',
        line: '',
        message: String(e.message || e)
      });

      return '<code>' + code + '</code>';
    }
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
   * Autodoc.parseName('Foo.prototype.bar').name           // => 'Foo#bar'
   * Autodoc.parseName('Foo.prototype.bar').shortName      // => 'bar'
   * Autodoc.parseName('Foo.Bar.prototype.baz').namespace  // => 'Foo.Bar'
   * Autodoc.parseName('Foo.prototype.bar').identifier     // => 'Foo-bar'
   * Autodoc.parseName('Foo.Bar.prototype.baz').identifier // => 'Foo-Bar-baz'
   * Autodoc.parseName('Foo').name                         // => 'Foo'
   * Autodoc.parseName('Foo').identifier                   // => 'Foo'
   * Autodoc.parseName('Foo').namespace                    // => null
   */
  Autodoc.parseName = function(name, fn) {
    var parts = name.split('.'),

        // e.g., the short name for 'Lib.utils.func' should be 'func'
        shortName = parts.pop(),

        // keep the long name too, for e.g. regurgitating it back in a template
        // (this is what we do w/ elevating private members)
        longName = name,

        // we'll say Foo.bar and Foo.prototype.bar both belong to the 'Foo'
        // namespace
        namespace = Lazy(parts).without('prototype').join('.');

    // As a convention we'll reformat 'Class.prototype.method' as 'Class#method'
    name = name.replace(/\.prototype\./, '#');

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
        namespace = Autodoc.getTagDescriptions(fn, 'memberOf')[0] || '';
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
   * @typedef {Object} PairInfo
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
   * @param {string[]} source
   * @param {string|string[]} tagNames
   * @param {DataCallback} callback
   * @returns {Array.<*>} An array of whatever the callback returns.
   */
  Autodoc.prototype.parseCommentLines = function(doc, source, tagNames, callback) {
    var self     = this,
        comments = Autodoc.getTags(doc, tagNames),
        results  = [];

    Lazy(comments).each(function(comment) {
      var baseLine     = comment.lineNumber,
          commentLines = comment.description.split('\n'),
          initialLines = [],
          pairs        = [],
          currentPair  = null,
          previousPair = null;

      Lazy(commentLines).each(function(line, i) {
        // Allow multiline expectations as long as subsequent lines are indented
        if ((/^\s+/).test(line) && currentPair) {
          currentPair.right += '\n' + line;
          currentPair.isMultiline = true;
          return;
        }

        var pair = self.parsePair(line);

        if (!pair && pairs.length === 0) {
          initialLines.push(line);

        } else if (pair) {
          pair.lineNumber = i;

          // Join pairs that actually take up two lines, like:
          // actual();
          // => expectation
          if (!pair.left) {
            // Allow actual value to be a multiline expression. As long as we
            // don't swallow up any previous assertions, we'll walk backwards
            // until encountering a blank line.
            pair.left = [];
            for (var line = i - 1; line >= 0 && (!previousPair || line > previousPair.lineNumber); --line) {
              if (isBlank(commentLines[line])) {
                break;
              }
              if (looksLikeComment(commentLines[line])) {
                continue;
              }

              pair.left.unshift(pairs.length === 0 ? initialLines.pop() : commentLines[line]);
            }

            pair.left = pair.left.join('\n');
          }

          pairs.push(pair);

          if (currentPair) {
            previousPair = currentPair;
          }
          currentPair = pair;

        } else {
          // Allow one final unindented line at the end of a multiline
          // expectation.
          if (currentPair) {
            if (currentPair.isMultiline) {
              currentPair.right += '\n' + line;
            }
            previousPair = currentPair;
          }
          currentPair = null;
        }
      });

      results.push(callback({
        content: comment.description,
        preamble: initialLines.join('\n'),
        lineNumber: baseLine,
        pairs: pairs
      }));
    });

    return results;
  };

  /**
   * Gets the tags with the specified tag name(s).
   *
   * @param {Object} doc
   * @param {string|string[]} tagNames
   * @returns {Array.<Object>}
   */
  Autodoc.getTags = function(doc, tagNames) {
    if (!(tagNames instanceof Array)) {
      tagNames = [tagNames];
    }

    return Lazy(doc.tags)
      .filter(function(tag) {
        return Lazy(tagNames).contains(tag.title);
      })
      .toArray();
  };

  /**
   * Gets the text descriptions from comment tags with the specified tag name(s).
   *
   * @param {Object} doc
   * @param {string|string[]} tagNames
   * @returns {Array.<string>}
   */
  Autodoc.getTagDescriptions = function(doc, tagNames) {
    return Lazy(Autodoc.getTags(doc, tagNames))
      .pluck('description')
      .toArray();
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
   * var autodoc = new Autodoc({
   *   exampleHandlers: [
   *     { pattern: /^custom pattern$/ }
   *   ]
   * });
   *
   * autodoc.parsePair('foo(bar)//=>5')      // => { left: 'foo(bar)', right: '5' }
   * autodoc.parsePair(' bar(baz) //=> 10 ') // => { left: 'bar(baz)', right: '10' }
   * autodoc.parsePair('foo // => bar')      // => { left: 'foo', right: 'bar' }
   * autodoc.parsePair('foo // bar')         // => { left: 'foo', right: 'bar' }
   * autodoc.parsePair('// => 5')            // => { left: '', right: '5' }
   * autodoc.parsePair('// bar')             // => null
   * autodoc.parsePair('// custom pattern')  // => { left: '', right: 'custom pattern' }
   * autodoc.parsePair('foo //')             // => null
   */
  Autodoc.prototype.parsePair = function(line) {
    var parts = line.match(/^\s*(.*)\s*\/\/\s*(=>)?\s*([^\s].*)$/);

    if (!parts) {
      return null;
    }

    // The => is only optional for single-line pairs, unless there's a custom
    // handler that matches the right-hand side.
    if (!parts[1] && !parts[2]) {
      if (!Lazy(this.exampleHandlers).any(function(handler) {
        return handler.pattern.test(parts[3]);
      })) return null;
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
   * @public
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
    node = node.unwrap();

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
    var substring = String.prototype.substring.apply(code, node.range);
    return unindent(substring);
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
   * Splits apart a camelCased string.
   *
   * @private
   * @param {string} string The string to split.
   * @returns {Array.<string>} An array containing the parts of the string.
   *
   * @examples
   * splitCamelCase('fooBarBaz');      // => ['foo', 'bar', 'baz']
   * splitCamelCase('Foo123Bar');      // => ['foo123', 'bar']
   * splitCamelCase('XMLHttpRequest'); // => ['xml', 'http', 'request']
   */
  function splitCamelCase(string) {
    var matcher  = /[^A-Z]([A-Z])|([A-Z])[^A-Z]/g,
        tokens   = [],
        position = 0,
        index, match;

    string || (string = '');

    while (match = matcher.exec(string)) {
      index = typeof match[1] === 'string' ? match.index + 1 : match.index;
      if (position === index) { continue; }
      tokens.push(string.substring(position, index).toLowerCase());
      position = index;
    }
    
    if (position < string.length) {
      tokens.push(string.substring(position).toLowerCase());
    }

    return tokens;
  }

  /**
   * Converts a string like 'fooBar' to 'foo-bar'.
   *
   * @private
   * @param {string} string The string to convert.
   * @returns {string} The same string, but hyphenated rather than camelCased.
   *
   * @examples
   * hyphenate('fooBarBaz');      // => 'foo-bar-baz'
   * hyphenate('Foo123Bar');      // => 'foo123-bar'
   * hyphenate('XMLHttpRequest'); // => 'xml-http-request'
   */
  function hyphenate(string) {
    return splitCamelCase(string).join('-');
  }

  /**
   * Converts a camelCased string to an acronym.
   *
   * @private
   * @param {string} string The string to convert.
   * @returns {string} An acronym (lower-case) comprising the first letter from
   *     each part of the string.
   *
   * @examples
   * acronym('fooBarBaz');      // => 'fbb'
   * acronym('foo123Bar');      // => 'fb'
   * acronym('XMLHttpRequest'); // => 'xhr'
   */
  function acronym(string) {
    return splitCamelCase(string).map(
      function(str) { return str.charAt(0); }).join('');
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
   * Unindents a multiline string based on the indentation level of the least-
   * indented line.
   *
   * @private
   * @param {string} string The string to unindent.
   * @param {boolean} skipFirstLine Whether or not to skip the first line for
   *     the purpose of determining proper indentation (defaults to `true`).
   * @returns {string} A new string that has effectively been unindented.
   *
   * @examples
   * unindent('foo\n  bar\n  baz');   // => 'foo\nbar\nbaz'
   * unindent('foo\n  bar\n    baz'); // => 'foo\nbar\n  baz'
   * unindent('foo\n\n  bar\n  baz'); // => 'foo\n\nbar\nbaz'
   * unindent('foo\n\n  bar\n baz');  // => 'foo\n\n bar\nbaz'
   */
  function unindent(string, skipFirstLine) {
    var lines     = string.split('\n'),
        skipFirst = typeof skipFirstLine !== 'undefined' ? skipFirstLine : true,
        start     = skipFirst ? 1 : 0;

    var indentation, smallestIndentation = Infinity;
    for (var i = start, len = lines.length; i < len; ++i) {
      if (isBlank(lines[i])) {
        continue;
      }

      indentation = getIndentation(lines[i]);
      if (indentation < smallestIndentation) {
        smallestIndentation = indentation;
      }
    }

    var result = [lines[0]]
      .concat(
        lines
          .slice(1)
          .map(function(line) { return decreaseIndent(line, smallestIndentation); })
      )
      .join('\n');

    return result;
  }

  /**
   * Determines how much a line is indented.
   *
   * @private
   * @param {string} line The line to look at.
   * @returns {number} The number of spaces the line is indented.
   *
   * @examples
   * getIndentation('');      // => 0
   * getIndentation('  bar'); // => 2
   */
  function getIndentation(line) {
    return line.match(/^(\s*)/)[1].length;
  }

  /**
   * Decreases the indentation of a line.
   *
   * @private
   * @param {string} line The line whose indentation you want to decrease.
   * @param {number} amount The number of spaces the given line's indentation
   *     should be decreased.
   * @returns {string} A new string with less indentation than the given one.
   *
   * @examples
   * decreaseIndent('  foo', 2);   // => 'foo'
   * decreaseIndent('    foo', 2); // => '  foo'
   * decreaseIndent('', 2);        // => ''
   */
  function decreaseIndent(line, amount) {
    return line.substring(amount);
  }

  /**
   * Determines if a string is empty or consists only of whitespace.
   *
   * @private
   * @param {string} string The string to check for blankness.
   * @returns {boolean} Whether or not the string is blank.
   *
   * @examples
   * isBlank('');             // => true
   * isBlank('foo');          // => false
   * isBlank('   ');          // => true
   * isBlank(' \n');          // => true
   * isBlank(' \t');          // => true
   * isBlank(' \r');          // => true
   * isBlank('foo\n  \nbar'); // => false
   */
  function isBlank(string) {
    return (/^\s*$/).test(string);
  }

  /**
   * Determines if a string looks like a JavaScript comment.
   *
   * @private
   * @param {string} string The string to check.
   * @returns {boolean} Whether or not the string looks like a JavaScript comment.
   *
   * @examples
   * looksLikeComment('');             // => false
   * looksLikeComment('foo');          // => false
   * looksLikeComment('// foo');       // => true
   * looksLikeComment('  // foo');     // => true
   * looksLikeComment('foo // bar');   // => false
   */
  function looksLikeComment(string) {
    return (/^\s*\/\//).test(string);
  }

  /**
   * Takes the first line of a string and, if there's more, appends '...' to
   * indicate as much.
   *
   * @private
   * @param {string} string The string whose first line you want to get.
   * @returns {string} The first line of the string.
   *
   * @examples
   * firstLine('foo');      // => 'foo'
   * firstLine('foo\nbar'); // => 'foo (...)'
   */
  function firstLine(string) {
    var lineBreak = string.indexOf('\n');

    if (lineBreak === -1) {
      return string;
    }

    return string.substring(0, lineBreak) + ' (...)';
  }

  /**
   * Prepends each line in a block of text w/ line numbers, optionally
   * highlighting a specific line.
   */
  function withLineNumbers(text, offendingLine) {
    if (typeof offendingLine !== 'number') {
      offendingLine = NaN;
    }

    var lines = text;
    if (typeof lines === 'string') {
      lines = lines.split('\n');
    }

    return lines.map(function(line, i) {
      line = (i + 1) + ': ' + line;
      if (i === (offendingLine - 1)) {
        line = '\x1B[31m' + line + '\x1B[39m';
      } else {
        line = '\x1B[90m' + line + '\x1B[39m';
      }
      return line;
    }).join('\n');
  }

  /**
   * Yes, removes the leading 'var' from a line. Leave me alone.
   *
   * @private
   * @param {string} string With leading var.
   * @returns {string} Without leading var.
   *
   * @examples
   * removeVar('var foo = 5');  // => '5'
   * removeVar('foo = "var x"') // => 'foo = "var x"'
   * removeVar('var _foo = 8'); // => '8'
   * removeVar('var $foo = 8'); // => '8'
   * removeVar('var a, b = 5'); // => 'var a, b = 5'
   */
  function removeVar(string) {
    return string.replace(/^\s*var\s*[\w\$]+\s*=\s*/, '');
  }

  /**
   * Checks if a string starts with a given prefix.
   *
   * @private
   * @param {string} string
   * @param {string} prefix
   * @returns {boolean}
   *
   * @examples
   * startsWith('foo', 'f');    // => true
   * startsWith('foo', 'foo');  // => true
   * startsWith('foo', 'fool'); // => false
   * startsWith('foo', 'oo');   // => false
   */
  function startsWith(string, prefix) {
    return string.lastIndexOf(prefix, 0) === 0;
  }

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
   * Updates the HTML representing a function's signature by replacing the '...'
   * with a link to the full source.
   */
  function insertSignatureLink(html, identifier) {
    return html.replace('/*...*/', '<a class="reveal-source" href="#source-' + identifier + '">/*...*/</a>');
  }

  /**
   * The default handlers defined for examples.
   */
  function exampleHandlers(customHandlers) {
    return (customHandlers || []).concat([
      {
        pattern: /^(\w[\w\.\(\)\[\]'"]*)\s*===?\s*(.*)$/,
        template: 'equality',
        data: function(match) {
          return {
            left: match[1],
            right: match[2]
          };
        }
      },
      {
        pattern: /^(\w[\w\.\(\)\[\]'"]*)\s*!==?\s*(.*)$/,
        template: 'inequality',
        data: function(match) {
          return {
            left: match[1],
            right: match[2]
          };
        }
      },
      {
        pattern: /^instanceof (.*)$/,
        template: 'instanceof',
        data: function(match) {
          return { type: match[1] };
        }
      },
      {
        pattern: /^NaN$/,
        template: 'nan'
      },
      {
        pattern: /^throws$/,
        template: 'throws'
      },
      {
        pattern: /^calls\s+(\w+)\s+(\d+)(?:\s+times?)?$/,
        template: 'calls',
        data: function(match) {
          return {
            callback: match[1],
            count: getCount(match[2])
          };
        }
      },
      {
        pattern: /^calls\s+(\w+)\s+(\d+)\s+times? asynchronously$/,
        template: 'calls_async',
        data: function(match) {
          return {
            callback: match[1],
            count: getCount(match[2])
          };
        }
      },
      {
        pattern: /^=~\s+\/(.*)\/$/,
        template: 'string_proximity',
        data: function(match) {
          return { pattern: match[1] };
        }
      },
      {
        pattern: /^=~\s+\[(.*),?\s*\.\.\.\s*\]$/,
        template: 'array_inclusion',
        data: function(match) {
          return { elements: match[1] };
        }
      },
      {
        pattern: /^one of (.*)$/,
        template: 'array_membership',
        data: function(match) {
          return { values: match[1] };
        }
      },
      {
        pattern: /^=~\s+\[(.*)\]$/,
        template: 'array_proximity',
        data: function(match) {
          return { elements: match[1] };
        }
      },
      {
        pattern: /^\[(.*),?\s*\.\.\.\s*\]$/,
        template: 'array_head',
        data: function(match) {
          return { head: match[1] };
        }
      },
      {
        pattern: /^\[\s*\.\.\.,?\s*(.*)\]$/,
        template: 'array_tail',
        data: function(match) {
          return { tail: match[1] };
        }
      },
      {
        pattern: /\{([\s\S]*),?[\s\n]*\.\.\.[\s\n]*\}/,
        template: 'object_proximity',
        data: function(match) {
          return { properties: match[1] };
        }
      }
    ]);
  }

  /**
   * Very simple word-to-number converter.
   *
   * @private
   * @examples
   * getCount('one');   // => 1
   * getCount('once');  // => 1
   * getCount('twice'); // => 2
   */
  function getCount(word) {
    switch (word.toLowerCase()) {
      case 'one':
      case 'once':
        return 1;

      case 'two':
      case 'twice':
        return 2;

      case 'three':
      case 'thrice':
        return 3;

      case 'four':
        return 4;

      case 'five':
        return 5;

      case 'six':
        return 6;

      case 'seven':
        return 7;

      case 'eight':
        return 8;

      case 'nine':
        return 9;

      case 'ten':
        return 10;
    }

    return word;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Autodoc;

  } else {
    context.Autodoc = Autodoc;
  }

}(typeof global !== 'undefined' ? global : this));
