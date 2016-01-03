'use strict';

const createQueryExecutor = require('./createQueryExecutor');

module.exports = function createTransactionExecutor(db) {
  return function executeTransaction(cb) {
    const tx = db.beginTransaction();

    const executeQuery = createQueryExecutor(tx);

    return Promise.resolve(executeQuery(cb))
      .then((result) => {
        return new Promise((resolve, reject) => {
          tx.commit((err) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      })
      .then(undefined, (err) => {
        if (tx.state === tx.STATE_OPEN || tx.state === tx.STATE_PENDING) {
          return new Promise((resolve, reject) => {
            tx.rollback(() => {
              reject(err);
            });
          });
        }

        throw err;
      });
  };
};
