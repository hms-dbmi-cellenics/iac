const config = require('./config');

module.exports = {
  'health#check': (req, res) => {
    res.json({
      status: 'up',
      env: process.env.NODE_ENV,
      clusterEnv: config.clusterEnv,
    });
  },
};
