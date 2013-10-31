require('should')

path      = require('path')
sinon     = require('sinon')
esprima   = require('esprima')
Breakneck = require('../')

describe 'Breakneck', ->
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

  describe 'parseComment', ->
    it 'wraps some text in /* and */ to pass to doctrine', ->
      parser = { parse: sinon.spy() }
      Breakneck.parseComment({ value: 'foo' }, parser)
      sinon.assert.calledWith(parser.parse, '/*foo*/', { unwrap: true })

  describe 'parse', ->
    it 'should be able to parse javascript without falling over', ->
      test = "/*\n * @name hello world\n *\n * @fileOverview\n * This is a test comment\n */"
      Breakneck.parse(test).name.should.eql 'hello world'
