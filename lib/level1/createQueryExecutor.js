'use strict';

const CypherQuery = require('./cypher').CypherQuery;

module.exports = function createQueryExecutor(context) {
  const executor = function executeQuery(query) {
    if (typeof query === 'function') {
      return query(executor);
    }

    const rawQuery = query instanceof CypherQuery
      ? query.getRawQuery()
      : query;

    return new Promise((resolve, reject) => {
      context.cypher(rawQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };

  return executor;
}
