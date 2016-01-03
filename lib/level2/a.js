'use strict';

class Pipe {
  constructor() {
    this._previous = null;
  }

  pipe(next) {
    next._compose(this);
    return next;
  }

  _compose(previous) {
    this._previous = previous;
    return this;
  }
}

class QueryPipe extends Pipe {
  constructor(executeQuery, opts, args) {
    super();
    this._executeQuery = executeQuery;
    this._query = opts.query;
    this._types = opts.types;
    this._args = args;
  }

  run() {
    const query = this._query.apply(null, this._args);
    const rawQuery = query.getRawQuery();

    rawQuery.query += '\nRETURN ' + Object.keys(this._types).join(', ');

    return this._executeQuery(rawQuery)
      .then(result => result.shift());
  }
}

class FunctionPipe extends Pipe {
  constructor(cb) {
    super();
    this._cb = cb;
  }

  run() {
    if (!this._previous) {
      return this._cb();
    }

    return this._previous.run()
      .then(result => this._cb(result));
  }
}

function defineQuery(opts) {
  return function() {
    const args = Array.prototype.slice.call(arguments);

    return new QueryPipe(executeQuery, opts, args);
  };
}

function run() {
  const args = Array.prototype.slice.call(arguments);

  const chain = args.reduce((p, i) => p.pipe(i));

  return chain.run();
}

// c

const GraphDatabase = require('neo4j').GraphDatabase;
const cypher = require('..').cypher;
const createQueryExecutor = require('..').createQueryExecutor;
const db = new GraphDatabase('http://localhost:7474');
const executeQuery = createQueryExecutor(db);

const createUser = defineQuery({
  query: (username) => cypher`
    CREATE (user:User {username: ${username}})
  `,
  types: {
    user: 'User'
  }
})

run(
  createUser('admin'),
  new FunctionPipe((res) => console.log(res.user))
).then(
  result => console.log(result),
  err => console.log(err)
)
