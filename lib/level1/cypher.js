'use strict';

class CypherQuery {
  constructor(strings, values) {
    this._strings = strings;
    this._values = values;
  }

  getRawQuery() {
    return this._getRawQuery({paramPrefix: 'p_'});
  }

  _getRawQuery(config) {
    const paramPrefix = config.paramPrefix;

    return this._strings
      .reduce((rawQuery, string, index) => {
        const query = rawQuery.query;
        const params = rawQuery.params;

        if (index === 0) {
          return {query: string, params: {}};
        }

        const paramIndex = index - 1;
        const value = this._values[paramIndex];

        if (value instanceof CypherQuery) {
          const options = value._getRawQuery({
            paramPrefix: paramPrefix + paramIndex + '_',
          });

          return {
            query: `${query}${options.query}${string}`,
            params: Object.assign({}, params, options.params),
          };
        }

        return {
          query: `${query}{${paramPrefix}${paramIndex}}${string}`,
          params: Object.assign({}, params, {
            [`${paramPrefix}${paramIndex}`]: value,
          }),
        };
      }, {query: '', params: {}});
  }
}

function cypher(strings) {
  const values = Array.prototype.slice.call(arguments, 1);

  return new CypherQuery(strings, values);
}

module.exports.CypherQuery = CypherQuery;
module.exports.cypher = cypher;
