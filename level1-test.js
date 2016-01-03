const GraphDatabase = require('neo4j').GraphDatabase;
const createTransactionExecutor = require('./lib').createTransactionExecutor;
const cypher = require('./lib').cypher;

const db = new GraphDatabase('http://localhost:7474');

const executeTransaction = createTransactionExecutor(db);

function getUser(uuid) {
  return (executeQuery) => pipe(
    executeQuery(cypher`
      MATCH (u:User {uuid: ${uuid}})
      RETURN u
    `),
    filterNode('u')
  );
}

executeTransaction(
  (executeQuery) => {
    const user = executeQuery(getUser(1));
    const account = executeQuery(createAccount(user));
    const cart = executeQuery(createCart());
  }
);
