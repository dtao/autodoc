class C
  ###
  Wraps any old object as a C instance.

  @examples
  new C({ foo: 'bar' }) // instanceof C
  ###
  constructor: (@obj) ->

  ###
  Indicates the type of the object wrapped.

  @examples
  new C('foo').type()          // 'string'
  new C(true).type()           // 'boolean'
  new C(10).type()             // 'number'
  new C({ foo: 'bar' }).type() // 'object'
  new C(function() {}).type()  // 'function'
  ###
  type: ->
    typeof @obj

module.exports = C
