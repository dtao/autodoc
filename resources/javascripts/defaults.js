(function(context) {

  /**
   * Default example handlers. These come AFTER any custom handlers --
   * that gives you the ability to override them, effectively. (Of course you
   * could also always just obliterate this property.)
   */
  this.exampleHandlers = (context.exampleHandlers || []).concat([
    {
      pattern: /^(\w[\w\.\(\)\[\]'"]*)\s*===?\s*(.*)$/,
      template: 'equality',
      data: function(match) {
        return {
          left: match[1],
          right: match[2]
        };
      }
    },
    {
      pattern: /^(\w[\w\.\(\)\[\]'"]*)\s*!==?\s*(.*)$/,
      template: 'inequality',
      data: function(match) {
        return {
          left: match[1],
          right: match[2]
        };
      }
    },
    {
      pattern: /^instanceof (.*)$/,
      template: 'instanceof',
      data: function(match) {
        return { type: match[1] };
      }
    },
    {
      pattern: /^NaN$/,
      template: 'nan'
    },
    {
      pattern: /^throws$/,
      template: 'throws'
    },
    {
      pattern: /^calls\s+(\w+)\s+(\d+)(?:\s+times?)?$/,
      template: 'calls',
      data: function(match) {
        return {
          callback: match[1],
          count: getCount(match[2])
        };
      }
    },
    {
      pattern: /^calls\s+(\w+)\s+(\d+)\s+times? asynchronously$/,
      template: 'calls_async',
      data: function(match) {
        return {
          callback: match[1],
          count: getCount(match[2])
        };
      }
    },
    {
      pattern: /^=~\s+\/(.*)\/$/,
      template: 'string_proximity',
      data: function(match) {
        return { pattern: match[1] };
      }
    },
    {
      pattern: /^=~\s+\[(.*),?\s*\.\.\.\s*\]$/,
      template: 'array_inclusion',
      data: function(match) {
        return { elements: match[1] };
      }
    },
    {
      pattern: /^one of (.*)$/,
      template: 'array_membership',
      data: function(match) {
        return { values: match[1] };
      }
    },
    {
      pattern: /^=~\s+\[(.*)\]$/,
      template: 'array_proximity',
      data: function(match) {
        return { elements: match[1] };
      }
    },
    {
      pattern: /^\[(.*),?\s*\.\.\.\s*\]$/,
      template: 'array_head',
      data: function(match) {
        return { head: match[1] };
      }
    },
    {
      pattern: /^\[\s*\.\.\.,?\s*(.*)\]$/,
      template: 'array_tail',
      data: function(match) {
        return { tail: match[1] };
      }
    },
    {
      pattern: /\{([\s\S]*),?[\s\n]*\.\.\.[\s\n]*\}/,
      template: 'object_proximity',
      data: function(match) {
        return { properties: match[1] };
      }
    }
  ]);

  function getCount(word) {
    switch (word.toLowerCase()) {
      case 'one':
      case 'once':
        return 1;

      case 'two':
      case 'twice':
        return 2;

      case 'three':
      case 'thrice':
        return 3;

      case 'four':
        return 4;

      case 'five':
        return 5;

      case 'six':
        return 6;

      case 'seven':
        return 7;

      case 'eight':
        return 8;

      case 'nine':
        return 9;

      case 'ten':
        return 10;
    }

    return word;
  }

}.call(this, typeof global !== 'undefined' ? global : this));
