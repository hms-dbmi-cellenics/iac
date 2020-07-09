const cacheDnsList = require('./cache-list');
const config = require('../config');

const getInstances = () => {
  const env = process.env.NODE_ENV === 'development' ? 'development' : 'production';
  if (env !== 'development') {
    return cacheDnsList[config.awsRegion];
  }
  return null;
};

module.exports = getInstances;
