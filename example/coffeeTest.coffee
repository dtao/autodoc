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
  new C('foo').type()          // => 'string'
  new C(true).type()           // => 'boolean'
  new C(10).type()             // => 'number'
  new C({ foo: 'bar' }).type() // => 'object'
  new C(->).type()             // => 'function'
  ###
  type: -> typeof @obj

  ###
  Clones the wrapped object.

  @examples
  arr = [1, 2, 3]

  new C(arr).clone()         // => [1, 2, 3]
  new C(arr).clone().push(4) // arr == [1, 2, 3]
  new C({ foo: 1 }).clone()  // => { foo: 1 }
  new C('foo').clone()       // => 'foo'
  new C(false).clone()       // => false
  new C(10).clone()          // => 10
  new C(->).clone()          // instanceof Function

  @benchmarks
  new C([1, 2, 3]).clone() // using C#clone
  [1, 2, 3].slice(0)       // using Array#slice
  ###
  clone: ->
    switch @type()
      when 'string', 'boolean', 'number' then return @obj
      when 'function' then return -> @obj.apply(this, arguments)

    return null if @obj is null
    return @cloneArray() if @obj instanceof Array
    return @cloneObject()

  cloneArray: ->
    @obj.slice(0)

  cloneObject: ->
    clone = {}
    for key of @obj
      clone[key] = @obj[key]
    clone

module.exports = C
