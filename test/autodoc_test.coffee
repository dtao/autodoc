fs       = require('fs')
path     = require('path')
esprima  = require('esprima')
doctrine = require('doctrine')
marked   = require('marked')
Autodoc  = require('../autodoc-node')
Lazy     = require('lazy.js')
sinon    = require('sinon')
should   = require('should')

parseFile = (filePath) ->
  js = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf-8')
  Autodoc.parse(js)

parseExampleFile = (fileName) ->
  parseFile('example/' + fileName)

getASTFromSource = (source) ->
  ast = esprima.parse source,
    comment: true
    loc: true
    range: true

  Autodoc.assignParents(ast)

  [ast, source]

getASTFromFile = (fileName) ->
  source = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf-8')
  getASTFromSource(source)

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

getMemberName = (data, shortName) ->
  Lazy(data.docs)
    .findWhere({ shortName: shortName })
    .name

listExamplesForMember = (data, shortName) ->
  Lazy(data.docs)
    .findWhere({ shortName: shortName })
    .examples
    .list

listPrivateFunctions = (data) ->
  Lazy(data.privateMembers)
    .pluck('name')
    .toArray()

getTypeDef = (data, typeName) ->
  Lazy(data.types)
    .findWhere({ name: typeName })

describe 'Autodoc', ->
  describe '#parseComment', ->
    it 'does NOT wrap comment text in /* and */ before passing to doctrine', ->
      parser = { parse: sinon.spy() }
      new Autodoc({ commentParser: parser }).parseComment({ value: 'foo' })
      sinon.assert.calledWith(parser.parse, 'foo', { unwrap: true })

    it 'strips out surrounding /* and */ before parsing comments', ->
      parser = { parse: sinon.spy() }
      new Autodoc({ commentParser: parser }).parseComment({ value: '/*foo*/' })
      sinon.assert.calledWith(parser.parse, 'foo', { unwrap: true })

  describe 'getIdentifierName', ->
    parse = (code) ->
      ast = esprima.parse(code)
      Autodoc.assignParents(ast)
      ast.body[0]

    it 'gets the name of a function declaration', ->
      node = parse('function foo() {}')
      Autodoc.getIdentifierName(node).should.eql('foo')

    it 'gets the name of a variable assigned a function expression', ->
      node = parse('var bar = function() {}')
      Autodoc.getIdentifierName(node.declarations[0]).should.eql('bar')

    it 'gets the name of an object member assigned a function expression', ->
      node = parse('foo.bar = function() {}')
      Autodoc.getIdentifierName(node).should.eql('foo.bar')

    it 'does not infer a name from a call expression on an anonymous function', ->
      [ast, source] = getASTFromSource('(function() {}).call()')

      node = ast.body[0] # ExpressionStatement
        .expression      # CallExpression
        .callee          # MemberExpression

      should(Autodoc.getIdentifierName(node)).eql(null)

    it 'replaces ".prototype." with "#"', ->
      node = parse('Foo.prototype.bar = function() {}')
      Autodoc.getIdentifierName(node).should.eql('Foo#bar')

  describe 'getFunctionSource', ->
    it 'provides the raw source code for a function', ->
      [ast, source] = getASTFromFile('example/redundant.js')

      # Yes, I am being lazy/hacky right now.
      clone = ast.body[1] # ExpressionStatement
        .expression       # AssignmentExpression
        .right            # FunctionExpression

      Autodoc.getFunctionSource(clone, source).should.eql(
        """
        function(array) {
          var clone = [];
          for (var i = 0; i < array.length; ++i) {
            clone.push(array[i]);
          }
          return clone;
        }
        """
      )

  describe 'parse', ->
    describe '"helloWorld.js" example', ->
      data = parseExampleFile('helloWorld.js')

      it 'pulls the library name from the @name tag', ->
        data.name.should.eql 'hello world'

      it 'pulls the description from the @fileOverview tag', ->
        data.description.should.match /^\s*<p>This is a description.<\/p>\s*$/

      it 'gets all namespaces', ->
        listNamespaces(data).should.contain 'Foo'
        listNamespaces(data).should.contain 'Foo.Bar'
        listNamespaces(data).should.not.contain 'privateFunction'
        listNamespaces(data).should.contain '[private]'

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

      it 'respects the @memberOf tag for the purpose of naming functions', ->
        getMemberName(data, 'parse').should.eql 'R.numbers.parse'

      it 'can get examples from the @example tag', ->
        keysExamples = listExamplesForMember(data, 'keys')
        keysExamples.length.should.eql 1
        keysExamples[0].should.have.property('actual', 'R.objects.keys({ foo: 1, bar: 2 })')
        keysExamples[0].should.have.property('expected', "['foo', 'bar']")

    describe '"module.js" example', ->
      data = parseExampleFile('module.js')

      it 'takes reference name from the module.exports line, if there is one', ->
        data.referenceName.should.eql 'Module'

    # Not sure how else to describe this!
    describe 'a library defined in a function passed as a parameter to an IIFE', ->
      data = parseExampleFile('genieTest.js')

      it 'is able to find the namespaces', ->
        listNamespaces(data).should.eql ['Genie', '[private]']

      it 'is able to find the private functions', ->
        listPrivateFunctions(data).should.eql ['baz']

  describe 'on Autodoc', ->
    data = parseFile('autodoc.js')

    it 'can read @typedefs', ->
      getTypeDef(data, 'TypeInfo').should.eql {
        name: 'TypeInfo',
        description: 'A custom type defined by a library.',
        properties: [
          {
            name: 'name',
            type: 'string',
            description: ''
          },
          {
            name: 'description',
            type: 'string',
            description: ''
          },
          {
            name: 'properties',
            type: 'Array.<PropertyInfo>',
            description: ''
          }
        ]
      }
