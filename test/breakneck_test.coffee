require('should')
sinon = require('sinon')
Breakneck = require('../source/javascripts/breakneck.js')

describe 'Breakneck', ->
  describe 'parseExample', ->
    it 'splits a line across the string "=>"', ->
      Breakneck.parseExample('foo(bar)=>5').should.eql({
        input: 'foo(bar)'
        output: '5'
      })

    it 'trims leading and trailing whitespace from each side', ->
      Breakneck.parseExample(' bar(baz) => 10 ').should.eql({
        input: 'bar(baz)'
        output: '10'
      })

  describe 'parseComment', ->
    it 'wraps some text in /* and */ to pass to doctrine', ->
      parser = { parse: sinon.spy() }
      Breakneck.parseComment({ value: 'foo' }, parser)
      sinon.assert.calledWith(parser.parse, '/*foo*/', { unwrap: true })
