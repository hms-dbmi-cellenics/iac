const cacheDnsList = require('./cache-list');
const config = require('../config');

const getInstances = () => {
  const env = process.env.NODE_ENV === 'development' ? 'development' : 'production';
  if (env !== 'development') {
    return cacheDnsList[config.awsRegion];
  } if (env === 'development') {
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
  }
  return null;
};

module.exports = getInstances;
