// See runner.js.
this.window = this;

importScripts(
  'lib/esprima/esprima.js',
  'lib/doctrine/doctrine.js',
  'lib/lazy.js/lazy.js'
);

var exampleId = 1;

function getExamples(doc) {
  var examplesTag = Lazy(doc.tags).findWhere({ title: 'examples' });

  if (typeof examplesTag === 'undefined') {
    return [];
  }

  return Lazy(examplesTag.description.split('\n'))
    .map(function(line) {
      var match = line.match(/^(.*)\s*=>\s*(.*)$/);
      if (!match) {
        return null;
      }

      return {
        id: exampleId++,
        input: match[1].replace(/^\s+/, ''),
        output: match[2].replace(/\s+$/, '')
      };
    })
    .compact()
    .toArray();
}

this.onmessage = function(e) {
  var code = e.data;

  var ast = esprima.parse(code, {
    comment: true,
    loc: true
  });

  var functions = Lazy(ast.body)
    .where({ type: 'FunctionDeclaration' })
    .groupBy(function(node) {
      return node.loc.start.line;
    })
    .toObject();

  var docs = Lazy(ast.comments)
    .map(function(comment) {
      var fn = functions[comment.loc.end.line + 1];
      if (typeof fn === 'undefined') {
        return null;
      }

      var doc = doctrine.parse('/*' + comment.value + '*/', { unwrap: true });
      if (typeof doc === 'undefined') {
        return null;
      }

      var examples = getExamples(doc);

      return {
        name: fn[0].id.name,
        description: marked(doc.description),
        examples: examples,
        hasExamples: examples.length > 0
      };
    })
    .compact()
    .toArray();

  postMessage(JSON.stringify({
    code: code,
    docs: docs
  }));
};
