'use strict';

const GraphDatabase = require('neo4j').GraphDatabase;
const cypher = require('./lib').cypher;
const createQueryExecutor = require('./lib').createQueryExecutor;

class Repository {
  constructor(baseLabel, executeQuery, wrapNode) {
    this._baseLabel = baseLabel;
    this._executeQuery = executeQuery;
    this._wrapNode = wrapNode;
  }

  _executeNodeQuery(query) {
    return this._executeArrayQuery(query)
      .then(result => result.shift());
  }

  _executeArrayQuery(query) {
    return this._executeQuery(query)
      .then(result => result.map(row => this._wrapNode(row.node)));
  }
}

function createSchema(db) {
  const allConstraits = {};
  const allTraits = {};

  const executeQuery = createQueryExecutor(db);

  function wrapNode(node) {
    const constraits = node.labels
      .map(label => allConstraits[label] || {})
      .reduce((acc, labelConstraits) => {
        return Object.keys(labelConstraits)
          .reduce((acc, key) => {
            return Object.assign(acc, {[key]: node.properties[key]});
          }, acc);
      }, {});

    const trait = node.labels
      .map(label => allTraits[label] || {})
      .reduce((acc, labelTrait) => {
        return Object.assign(acc, labelTrait);
      }, {});

    return Object.assign(constraits, trait);
  }

  function registerConstraits(label, labelConstraits) {
    allConstraits[label] = labelConstraits;
  }

  function registerTrait(label, labelTrait) {
    allTraits[label] = labelTrait;
  }

  function createRepository(label, methods) {
    const repo = new Repository(label, executeQuery, wrapNode);

    Object.assign(repo, methods);

    return repo;
  }

  return {
    registerConstraits,
    registerTrait,
    createRepository,
  };
}

///////

const db = new GraphDatabase('http://localhost:7474');
const schema = createSchema(db);

schema.registerConstraits('Session', {
  sid: {
    type: String,
    unique: true,
    nullable: false,
    required: true,
    defaultValue: () => uuid.v4(),
  },
})

schema.registerConstraits('User', {
  uuid: {
    type: String,
    unique: true,
    nullable: false,
    required: true,
    defaultValue: () => uuid.v4(),
  },
  email: {
    type: String,
    unique: true,
    nullable: false,
    required: true,
  },
})

const userRepo = schema.createRepository('User', {
  findAll() {
    return this._executeArrayQuery(cypher`
      MATCH (u:User)
      RETURN u as node
    `)
  },
  getUserSessions(user) {
    return this._executeArrayQuery(cypher`
      MATCH (s:Session)<-[:OWNS]-(:User {uuid: ${user.uuid}})
      RETURN s as node
    `);
  }
});

const sessionRepo = schema.createRepository('Session', {
  getSessionOwner(session) {
    return this._executeArrayQuery(cypher`
      MATCH (u:User)-[:OWNS]->(:Session {sid: ${session.sid}})
      RETURN u as node
    `)
  }
});

schema.registerTrait('Session', {
  getOwner() {
    return sessionRepo.getSessionOwner(this);
  }
});

schema.registerTrait('User', {
  getSessions() {
    return userRepo.getUserSessions(this);
  }
});

userRepo.findAll()
  .then(users => {
    console.log(users);
    return users.shift();
  })
  .then(user => {
    return user.getSessions();
  })
  .then(sessions => {
    console.log(sessions);
    return Promise.all(sessions.map(session => session.getOwner()));
  })
  .then(undefined, error => {
    console.log(error);
  });
