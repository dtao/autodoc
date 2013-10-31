require('should')

path      = require('path')
sinon     = require('sinon')
esprima   = require('esprima')
doctrine  = require('doctrine')
marked    = require('marked')
Breakneck = require('../')

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

  describe 'parseName', ->
    it 'includes the original name in the returned data', ->
      Breakneck.parseName('Foo#bar').name.should.eql('Foo#bar')

    it 'takes a long name and also provides a short name', ->
      Breakneck.parseName('Foo#bar').shortName.should.eql('bar')

    it 'includes the namespace', ->
      Breakneck.parseName('Foo.Bar#baz').namespace.should.eql('Foo.Bar')

    it 'also provides a convenient dash-separated identifier', ->
      Breakneck.parseName('Foo#bar').identifier.should.eql('Foo-bar')

    it 'for constructors/namespaces, sets the name to the namespace', ->
      Breakneck.parseName('Foo').name.should.eql('Foo')

    it 'for constructors/namespaces, sets the identifier to the namespace', ->
      Breakneck.parseName('Foo').identifier.should.eql('Foo')

  describe 'parsePair', ->
    it 'splits a line across the string "//=>"', ->
      Breakneck.parsePair('foo(bar)//=>5').should.eql({
        left: 'foo(bar)'
        right: '5'
      })

    it 'trims leading and trailing whitespace from each side', ->
      Breakneck.parsePair(' bar(baz) //=> 10 ').should.eql({
        left: 'bar(baz)'
        right: '10'
      })

    it 'allows whitespace between the // and =>', ->
      Breakneck.parsePair('foo // => bar').should.eql({
        left: 'foo'
        right: 'bar'
      })

    it "doesn't actually require a '=>' at all", ->
      Breakneck.parsePair('foo // bar').should.eql({
        left: 'foo'
        right: 'bar'
      })

  describe 'parse', ->
    source =
      """
        /**
         * @name hello world
         *
         * @fileOverview
         * This is a description.
         */
      """

    data = Breakneck.parse source,
      codeParser: esprima
      commentParser: doctrine
      markdownParser: marked

    it 'pulls the library name from the @name tag', ->
      data.name.should.eql 'hello world'

    it 'pulls the description from the @fileOverview tag', ->
      data.description.should.match /^\s*<p>This is a description.<\/p>\s*$/
