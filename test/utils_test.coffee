path  = require('path')
utils = require(path.join(__dirname, '../resources/utils.js'))

describe 'formatNumber', ->
  it 'adds decimals up to 3 places', ->
    utils.formatNumber(3.14).should.eql('3.140')

  it 'trims decimals down to 3 places', ->
    utils.formatNumber(3.14159265359).should.eql('3.142')

  it 'adds commas as a thousands separator', ->
    utils.formatNumber(1000).should.eql('1,000.000')

  it 'works for very large numbers', ->
    utils.formatNumber(123456789.123456789).should.eql('123,456,789.123')
