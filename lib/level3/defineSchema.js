'use strict';

function createSchema() {
  function defineType(config, cls) {
    const Type = class extends cls {}

    Type.config = config;

    Object.keys(config)
      .forEach((key) => {
        const property = config[key];
        const validation = property.validation;

        Object.defineProperty(Type.prototype, key, {
          enumerable: true,
          get: function() {
            return this._cache[key];
          },
          set: function(value) {
            this._cache[key] = value;
          },
        })
      });

    const type = {
      name: cls.name,
      createInstance(data) {
        return new Type(data && data.properties || {});
      }
    };

    return type;
  }

  return {
    defineType,
  };
}

////////

class Model {
  constructor(opts) {
    this._cache = Object.create(null);

    const config = this.getConfig();

    Object.keys(config)
      .forEach((key) => {
        const property = config[key];

        if (opts.hasOwnProperty(key)) {
          this[key] = opts[key];
        } else {
          const value = property.defaultValue;

          this[key] = typeof value === 'function'
            ? value()
            : value;
        }
      });
  }

  getConfig() {
    return this.constructor.config;
  }
}

////////

const createQueryExecutor = require('../level1/createQueryExecutor');
const cypher = require('../level1/cypher').cypher;

class Repository {
  constructor(db, schema) {
    this._db = db;
    this._schema = schema;
    this._executeQuery = createQueryExecutor(db);
  }

  getType() {
    return this.constructor.config.type;
  }

  findAllQuery(key) {
    return cypher`
      MATCH (node)
      WHERE ${this.getType().name} in labels(node)
      WITH node
    `;
  }

  findAll() {
    return this._executeArrayQuery(cypher`
      ${this.findAllQuery()}
    `);
  }

  _executeNodeQuery(query) {
    return this._executeArrayQuery(query)
      .then(result => result.shift());
  }

  _executeArrayQuery(query) {
    const type = this.getType();

    return this._executeQuery(cypher`
        ${query}
        RETURN node
      `)
      .then(result => result.map(row => type.createInstance(row.node)));
  }
}

///////

const GraphDatabase = require('neo4j').GraphDatabase;
const uuid = require('node-uuid');

const db = new GraphDatabase('http://localhost:7474');
const schema = createSchema();

const Session = schema.defineType({
  sid: {
    type: String,
  },
}, class Session extends Model {});

const User = schema.defineType({
  uuid: {
    type: String,
  },
  email: {
    type: String,
  },
}, class User extends Model {});

class UserRepository extends Repository {
  filterUsersByRoleQuery(role) {
    return cypher`
      WHERE node.role = ${role}
      WITH node
    `;
  }

  orderByEmailQuery() {
    return cypher`
      ORDER BY node.email DESC
      WITH node
    `;
  }

  findRegularUsers() {
    return this._executeArrayQuery(cypher`
      ${this.findAllQuery()}
      ${this.filterUsersByRoleQuery('USER')}
      ${this.orderByEmailQuery()}
    `);
  }
}
UserRepository.config = {
  type: User,
};

const userRepo = new UserRepository(db, schema);

userRepo.findRegularUsers().then(
  a => console.log(a),
  a => console.log(a)
)
