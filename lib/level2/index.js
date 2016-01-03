'use strict';

class Query {
  constructor(db, fragments) {
    this._db = db;
    this._fragments = fragments || [];
  }

  out(name) {
    this._fragments.push({type: 'out', name});
    return this;
  }

  withLabel(name) {
    this._fragments.push({type: 'withLabel', name});
    return this;
  }

  getQuery() {
    const params = {};

    let paramIndex = 0;
    const injectParam = (value) => {
      const key = `p${paramIndex++}`;
      params[key] = value;
      return key;
    };

    const query = this._fragments
      .reduce((query, fragment) => {
        switch (fragment.type) {
          case 'vectors':
            query.push(`MATCH (outV)`);
            query.push(`WHERE id(outV) IN {${injectParam(fragment.vectors.map(v => v._id))}}`);
            query.push(`WITH outV AS inV`);
            break;
          case 'vector':
            query.push(`MATCH (outV)`);
            query.push(`WHERE id(outV) = {${injectParam(fragment.vector._id)}}`);
            query.push(`WITH outV AS inV`);
            break;
          case 'out':
            query.push(`MATCH (inV)-[:${fragment.name}]->(outV)`);
            query.push(`WITH outV AS inV`);
            break;
          case 'withLabel':
            query.push(`WHERE {${injectParam(fragment.name)}} IN labels(inV)`);
            query.push(`WITH inV`);
            break;
          default:
            throw new Error(`Unknown query fragment "${fragment.type}"`);
        }

        return query;
      }, []);

    query.push(`RETURN inV as node`)

    return {
      query: query.join('\n'),
      params,
    };
  }

  _print() {
    const query = this.getQuery();
    console.log(query.query);
    console.log(JSON.stringify(query.params));
    return this;
  }

  execute() {
    return new Promise((resolve, reject) => {
      this._db.cypher(this.getQuery(), (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.map(row => row.node));
        }
      });
    });
  }
}

class VectorQuery extends Query {
  constructor(db, vector) {
    super(db, [{type: 'vector', vector}]);
  }
}

class VectorsQuery extends Query {
  constructor(db, vectors) {
    super(db, [{type: 'vectors', vectors}]);
  }
}

///

const GraphDatabase = require('neo4j').GraphDatabase;
const cypher = require('..').cypher;
const createQueryExecutor = require('..').createQueryExecutor;

const db = new GraphDatabase('http://localhost:7474');

const executeQuery = createQueryExecutor(db);

executeQuery(cypher`MATCH (n:User) RETURN n`)
  .then(response => response.map(row => row.n))
  .then(users => {

    return new VectorsQuery(db, users)     // MATCH (outV) WHERE id(outV) IN ${ids} WITH outV AS inV
      .out('OWNS')                       // MATCH (inV)-->(outV) WITH outV AS inV
      .withLabel('Session')              // WHERE {label} IN labels(inV) WITH inV
      ._print()
      .execute();

  })
  .then(result => console.log(result))
  .then(undefined, err => console.log(err));

///

// MATCH (a:Account {uuid: ${account.properties.uuid}})
// MATCH (t:Transaction)-[:FROM|:TO]->(a)
// WITH a, collect(t) as ts
// WITH filter(ot in ts where exists((ot)-[:FROM]->(a))) as ots, filter(it in ts where exists((it)-[:TO]->(a))) as its
// RETURN ots, its

db
  .vector(account)          // -> Node<Account>
  .out('from')              // -> Node<*>
  .withLabel('Transaction') // -> Node<Transaction>


// MATCH (u:User {uuid: ${info.rootValue.user.properties.uuid}})
// MATCH (c:Cart)<-[:OWNS]-(u)
// MATCH (l:Location {uuid: ${fromGlobalId(locationId).id}})
// OPTIONAL MATCH (:Location)-[p:ATTACHED_TO]->(c)
// DELETE p
// CREATE (l)-[:ATTACHED_TO]->(c)
// RETURN u, c, l

const {newLocation} = await db.vector(id).as('newLocation').run(); // MATCH (newLocation) WHERE id(newLocation) = {id} RETURN newLocation
const {user, cart, previousEdge} = db
  .vector(id).as('user')                                       // MATCH (user) WHERE id(user) = {id}
  .out('OWNS').withLabel('Cart').as('cart')                    // MATCH (user)-[:OWNS]->(cart:Cart)
  .inE('ATTACHED_TO').as('previousEdge').withLabel('Location') // MATCH (cart)<-[previousEdge:ATTACHED_TO]-(:Location)
  .run();                                                      // RETURN user, cart, previousEdge

if (previousEdge) {
  db.deleteEdge(previousEdge);
}

db.createEdge('ATTACHED_TO', cart, newLocation);
