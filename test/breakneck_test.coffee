require('should')
sinon = require('sinon')
Breakneck = require('../source/javascripts/breakneck.js')

describe 'Breakneck', ->
  describe 'parseComment', ->
    it 'wraps some text in /* and */ to pass to doctrine', ->
      parser = { parse: sinon.spy() }
      Breakneck.parseComment({ value: 'foo' }, parser)
      sinon.assert.calledWith(parser.parse, '/*foo*/', { unwrap: true })
