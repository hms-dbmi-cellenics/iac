const cacheDnsList = require('./cache-list');
const config = require('../config');

const getInstances = () => {
  const env = config.clusterEnv;

  if (env !== 'development') {
    return cacheDnsList[config.awsRegion];
  }

  return {
    master: {
      host: 'localhost',
      port: '6379',
    },
    slaves: [
      {
        host: 'localhost',
        port: '6379',
      },
    ],
  };
};

module.exports = getInstances;
