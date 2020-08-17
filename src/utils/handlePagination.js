const _ = require('lodash');

const handlePagination = (results, pagination) => {
  const {
    orderBy, orderDirection, offset, limit, responseKey,
  } = pagination;

  const body = JSON.parse(results[responseKey].body);
  let { rows } = body;
  const total = rows.length;
  rows = _.orderBy(rows, [orderBy], [orderDirection.toLowerCase()]);
  rows = rows.slice(offset, offset + limit);

  // eslint-disable-next-line no-param-reassign
  results[responseKey].body = JSON.stringify({ ...body, rows, total });

  return results;
};

module.exports = { handlePagination };
