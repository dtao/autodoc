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
  examples = Lazy(data.docs)
    .findWhere({ shortName: shortName })
    .examples

  Lazy(examples)
    .pluck('list')
    .flatten()
    .toArray()

listPrivateFunctions = (data) ->
  Lazy(data.privateMembers)
    .pluck('name')
    .toArray()

listMethodsOfPrivateFunction = (data, shortName) ->
  privateFunction = Lazy(data.privateMembers)
    .findWhere({ shortName: shortName })

  Lazy(privateFunction.methods)
    .pluck('longName')
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
        listNamespaces(data).should.include 'Foo'
        listNamespaces(data).should.include 'Foo.Bar'
        listNamespaces(data).should.not.include 'privateFunction'
        listNamespaces(data).should.include '[private]'

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
        listMembersForNamespace(data, 'R.strings').should.eql ['split', 'toUpperCase']

      it 'respects the @memberOf tag for the purpose of naming functions', ->
        getMemberName(data, 'parse').should.eql 'R.numbers.parse'

      it 'can get examples from the @example tag', ->
        keysExamples = listExamplesForMember(data, 'keys')
        keysExamples.length.should.eql 1
        keysExamples[0].should.have.property('actual', 'R.objects.keys({ foo: 1, bar: 2 })')
        keysExamples[0].should.have.property('expected', "['foo', 'bar']")

      it 'gets examples from ALL @example/@examples tags', ->
        parseExamples = listExamplesForMember(data, 'parse')
        parseExamples.length.should.eql 13
        parseExamples[12].should.have.property('actual', "R.numbers.parse('abc123def')")
        parseExamples[12].should.have.property('expected', "NaN")

      it 'includes private methods with examples', ->
        listPrivateFunctions(data).should.include 'privateWithExample'

      it 'includes private constructors with members', ->
        listPrivateFunctions(data).should.include 'PrivateWithMembers'

      it 'includes members of private methods', ->
        listMethodsOfPrivateFunction(data, 'PrivateWithMembers')
          .should.include 'PrivateWithMembers.prototype.foo'

      xit 'excludes private methods with no examples', ->
        listPrivateFunctions(data).should.not.include 'privateWithoutExample'

      describe 'multiline expressions', ->
        insertExamples = listExamplesForMember(data, 'insert')
        mapExamples = listExamplesForMember(data, 'map')

        it 'supports multiline expectations', ->
          insertExamples[1].should.have.property('expected', "[{\n  foo: 'bar'\n}]")

        it 'supports multiline expressions', ->
          mapExamples[0].should.have.property('actual', '[1, 2, 3].map(function(x) {\n  return x * -1;\n});')

        it 'does not include comments in multiline expressions', ->
          mapExamples[1].should.have.property('actual', "['foo', 'bar'].map(function(str) {\n  return str.toUpperCase();\n});")

        it 'does not swallow previous assertions when scanning multiline expressions', ->
          mapExamples[2].should.have.property('actual', '[1.5, 3.14].map(Math.floor);')
          mapExamples[2].should.have.property('expected', '[1, 3]')
          mapExamples[3].should.have.property('actual', "[[], [1, 2], 'foo', { length: 'bar' }].map(function(obj) {\n  return obj.length;\n});")

      # dangerous territory here, I know
      it 'ignores superfluous "var" declarations', ->
        cloneExamples = listExamplesForMember(data, 'clone')
        cloneExamples.pop().should.have.property('actual', 'R.arrays.clone(arr2);')

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
      getTypeDef(data, 'TypeInfo').should.include {
        name: 'TypeInfo',
        identifier: 'type-TypeInfo',
        description: '<p>A custom type defined by a library.</p>\n',
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
          },
          {
            name: 'tags',
            type: 'Array.<string>',
            description: ''
          }
        ]
      }
