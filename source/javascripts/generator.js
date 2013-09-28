importScripts(
  '/lib/esprima/esprima.js',
  '/lib/doctrine/doctrine.js',
  '/lib/lazy.js/lazy.js',
  '/lib/marked/lib/marked.js'
);

var exampleIdCounter   = 1,
    benchmarkIdCounter = 1;

function parseComment(comment) {
  return doctrine.parse('/*' + comment.value + '*/', { unwrap: true });
}

function formatType(type) {
  switch (type.type) {
    case 'NameExpression':
      return type.name;
    case 'TypeApplication':
      return formatType(type.expression) + '.<' + Lazy(type.applications).map(formatType).join('|') + '>';
    case 'AllLiteral':
      return '*';
    default:
      throw 'WTF!';
  }
}

function getParams(doc) {
  var paramTags = Lazy(doc.tags).where({ title: 'param' });

  return paramTags
    .map(function(tag) {
      return {
        name: tag.name,
        type: formatType(tag.type),
        description: tag.description || ''
      };
    })
    .toArray();
}

function getReturns(doc) {
  var returnTag = Lazy(doc.tags).findWhere({ title: 'returns' });

  if (typeof returnTag === 'undefined') {
    return {};
  }

  return {
    type: formatType(returnTag.type),
    description: returnTag.description || ''
  };
}

function getSignature(name, params) {
  return 'function ' + name + '(' + Lazy(params).pluck('name').join(', ') + ')';
}

function splitCommentLines(doc, tagName, callback) {
  var tag = Lazy(doc.tags).findWhere({ title: tagName });

  if (typeof tag === 'undefined') {
    return [];
  }

  return Lazy(tag.description.split('\n'))
    .map(function(line) {
      return line.match(/^(.*)\s*=>\s*(.*)$/);
    })
    .compact()
    .map(function(match) {
      return callback(
        match[1],
        match[2]
      );
    })
    .toArray();
}

function getExamples(doc) {
  return splitCommentLines(doc, 'examples', function(left, right) {
    return {
      id: exampleIdCounter++,
      input: left,
      output: right
    };
  });
}

function getBenchmarks(doc) {
  return splitCommentLines(doc, 'benchmarks', function(left, right) {
    return {
      id: benchmarkIdCounter++,
      name: left,
      impl: right
    };
  });
}

function getLibraryInfo(comments) {
  var docWithFileOverview = Lazy(comments)
    .map(parseComment)
    .compact()
    .filter(function(doc) {
      return Lazy(doc.tags).where({ title: 'fileOverview' }).any();
    })
    .first();

  var libraryName = 'Untitled Library',
      libraryDesc = '[No description]';

  if (docWithFileOverview) {
    libraryDesc = Lazy(docWithFileOverview.tags).findWhere({ title: 'fileOverview' }).description;

    var libraryNameTag = Lazy(docWithFileOverview.tags).findWhere({ title: 'name' });
    if (libraryNameTag) {
      libraryName = libraryNameTag.description;
    }
  }

  return {
    name: libraryName,
    description: marked(libraryDesc)
  };
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

  var comments = ast.comments;

  var docs = Lazy(comments)
    .map(function(comment) {
      var fn = functions[comment.loc.end.line + 1];
      if (typeof fn === 'undefined') {
        return null;
      }

      var doc = parseComment(comment);
      if (typeof doc === 'undefined') {
        return null;
      }
      if (!doc.description && doc.examples.length === 0) {
        return null;
      }

      var name       = fn[0].id.name,
          params     = getParams(doc),
          returns    = getReturns(doc),
          signature  = getSignature(name, params),
          examples   = getExamples(doc),
          benchmarks = getBenchmarks(doc);

      return {
        name: name,
        description: marked(doc.description),
        params: params,
        returns: returns,
        hasSignature: params.length > 0 || !!returns,
        signature: signature,
        examples: examples,
        hasExamples: examples.length > 0,
        benchmarks: benchmarks,
        hasBenchmarks: benchmarks.length > 0
      };
    })
    .compact()
    .toArray();

  var libraryInfo = getLibraryInfo(comments);

  postMessage(JSON.stringify({
    name: libraryInfo.name,
    description: libraryInfo.description,
    code: code,
    docs: docs
  }));
};
