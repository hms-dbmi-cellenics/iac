const config = require('../../config');
const cache = require('../../cache');

module.exports = {
  'health#check': (req, res) => {
    res.json({
      status: 'up',
      env: process.env.NODE_ENV,
      clusterEnv: config.clusterEnv,
      cacheStatus: cache.areConnectionsHealthy(),
    });
  },
};
