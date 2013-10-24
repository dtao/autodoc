require('should')

sinon     = require('sinon')
esprima   = require('esprima')
Breakneck = require('../source/javascripts/breakneck.js')

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

  describe 'parsePair', ->
    it 'splits a line across the string "//=>"', ->
      Breakneck.parsePair('foo(bar)//=>5').should.eql({
        input: 'foo(bar)'
        output: '5'
      })

    it 'trims leading and trailing whitespace from each side', ->
      Breakneck.parsePair(' bar(baz) //=> 10 ').should.eql({
        input: 'bar(baz)'
        output: '10'
      })

    it 'allows whitespace between the // and =>', ->
      Breakneck.parsePair('foo // => bar').should.eql({
        input: 'foo'
        output: 'bar'
      })

    it "doesn't actually require a '=>' at all", ->
      Breakneck.parsePair('foo // bar').should.eql({
        input: 'foo'
        output: 'bar'
      })

  describe 'parseComment', ->
    it 'wraps some text in /* and */ to pass to doctrine', ->
      parser = { parse: sinon.spy() }
      Breakneck.parseComment({ value: 'foo' }, parser)
      sinon.assert.calledWith(parser.parse, '/*foo*/', { unwrap: true })
