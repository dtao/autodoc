path      = require('path')
esprima   = require('esprima')
doctrine  = require('doctrine')
marked    = require('marked')
Autodoc   = require('../')
Lazy      = require('lazy.js')
sinon     = require('sinon')
should    = require('should')

describe 'Autodoc', ->
  describe '#parseComment', ->
    it 'wraps some text in /* and */ to pass to doctrine', ->
      parser = { parse: sinon.spy() }
      new Autodoc({ commentParser: parser }).parseComment({ value: 'foo' })
      sinon.assert.calledWith(parser.parse, '/*foo*/', { unwrap: true })

  describe 'getIdentifierName', ->
    parse = (code) ->
      esprima.parse(code).body[0]

    it 'gets the name of a function declaration', ->
      node = parse('function foo() {}')
      Autodoc.getIdentifierName(node).should.eql('foo')

    it 'gets the name of a variable assigned a function expression', ->
      node = parse('var bar = function() {}')
      Autodoc.getIdentifierName(node.declarations[0]).should.eql('bar')

    it 'gets the name of an object member assigned a function expression', ->
      node = parse('foo.bar = function() {}')
      Autodoc.getIdentifierName(node).should.eql('foo.bar')

    it 'replaces ".prototype." with "#"', ->
      node = parse('Foo.prototype.bar = function() {}')
      Autodoc.getIdentifierName(node).should.eql('Foo#bar')

  describe 'parse', ->
    source =
      """
        /**
         * @name hello world
         *
         * @fileOverview
         * This is a description.
         */

        /**
         * The main namespace.
         */
        function Foo() {};

        /**
         * Returns 'foo'
         *
         * @returns {string}
         */
        Foo.getName = function() {
          return 'foo';
        };

        Foo.Bar = {
          /**
           * Returns 'bar'
           *
           * @returns {string}
           */
          getName: function() {
            return 'bar';
          },

          /**
           * Returns 'baz'
           *
           * @returns {string}
           */
          getBaz: function() {
            return 'baz';
          }
        };
      """

    data = Autodoc.parse source,
      codeParser: esprima
      commentParser: doctrine
      markdownParser: marked

    listNamespaces = (data) ->
      Lazy(data.namespaces)
        .pluck('namespace')
        .toArray()

    listMembersForNamespace = (data, namespace) ->
      members = Lazy(data.namespaces)
        .findWhere({ namespace: namespace })
        .members

      Lazy(members)
        .pluck('shortName')
        .toArray()

    it 'pulls the library name from the @name tag', ->
      data.name.should.eql 'hello world'

    it 'pulls the description from the @fileOverview tag', ->
      data.description.should.match /^\s*<p>This is a description.<\/p>\s*$/

    it 'gets all namespaces', ->
      listNamespaces(data).should.eql ['Foo', 'Foo.Bar']

    it 'groups functions by namespace', ->
      listMembersForNamespace(data, 'Foo').should.eql ['getName']
      listMembersForNamespace(data, 'Foo.Bar').sort().should.eql ['getBaz', 'getName']

    it 'infers a "reference name" based on the first namespace w/ members', ->
      data.referenceName.should.eql 'Foo'

    it 'takes the leftmost part of the root namespace', ->
      source =
        """
          var Root = {
            submodule1: {},
            submodule2: {}
          };

          /**
           * Hey I have comments.
           */
          Root.submodule1.foo = function() {
            return 'foo';
          };

          /**
           * Me too me too!
           */
          Root.submodule2.bar = function() {
            return 'bar';
          };
        """

      Autodoc.parse(source).referenceName.should.eql 'Root'
