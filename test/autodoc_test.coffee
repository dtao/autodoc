fs       = require('fs')
path     = require('path')
esprima  = require('esprima')
doctrine = require('doctrine')
marked   = require('marked')
Autodoc  = require('../autodoc-node')
Lazy     = require('lazy.js')
sinon    = require('sinon')
should   = require('should')

parseExampleFile = (fileName) ->
  js = fs.readFileSync(path.join(__dirname, '..', 'example', fileName), 'utf-8')
  Autodoc.parse(js)

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

    describe '"helloWorld.js" example', ->
      data = parseExampleFile('helloWorld.js')

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

    describe '"root.js" example', ->
      data = parseExampleFile('root.js')

      it 'takes the leftmost part of the root namespace', ->
        data.referenceName.should.eql 'Root'

    describe '"redundant.js" example', ->
      data = parseExampleFile('redundant.js')

      it 'can infer namespaces from object expressions', ->
        listNamespaces(data).should.include 'R.objects'

      it 'also respects the @memberOf tag for explicitly defining namespaces', ->
        listMembersForNamespace(data, 'R.strings').should.eql ['split']

    describe '"module.js example', ->
      data = parseExampleFile('module.js')

      it 'takes reference name from the module.exports line, if there is one', ->
        data.referenceName.should.eql 'Module'
