/* eslint-disable global-require */

let config;

if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
  config = require('./test-config');
} else {
  config = require('./default-config');
}

module.exports = config;
