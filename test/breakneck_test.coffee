path      = require('path')
esprima   = require('esprima')
doctrine  = require('doctrine')
marked    = require('marked')
Breakneck = require('../')
Lazy      = require('lazy.js')
sinon     = require('sinon')
should    = require('should')

describe 'Breakneck', ->
  describe '#parseComment', ->
    it 'wraps some text in /* and */ to pass to doctrine', ->
      parser = { parse: sinon.spy() }
      new Breakneck({ commentParser: parser }).parseComment({ value: 'foo' })
      sinon.assert.calledWith(parser.parse, '/*foo*/', { unwrap: true })

  describe 'getIdentifierName', ->
    parse = (code) ->
      esprima.parse(code).body[0]

    it 'gets the name of a function declaration', ->
      node = parse('function foo() {}')
      Breakneck.getIdentifierName(node).should.eql('foo')

    it 'gets the name of a variable assigned a function expression', ->
      node = parse('var bar = function() {}')
      Breakneck.getIdentifierName(node).should.eql('bar')

    it 'gets the name of an object member assigned a function expression', ->
      node = parse('foo.bar = function() {}')
      Breakneck.getIdentifierName(node).should.eql('foo.bar')

    it 'replaces ".prototype." with "#"', ->
      node = parse('Foo.prototype.bar = function() {}')
      Breakneck.getIdentifierName(node).should.eql('Foo#bar')

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
      """

    data = Breakneck.parse source,
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
      listNamespaces(data).should.eql ['Foo']

    it 'groups functions by namespace', ->
      listMembersForNamespace(data, 'Foo').should.eql ['getName']

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

      Breakneck.parse(source).referenceName.should.eql 'Root'
