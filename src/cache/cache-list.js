const AWS = require('aws-sdk');
const config = require('../../config');

const getRedisEndpoints = async () => {
  const ec = new AWS.ElastiCache({
    region: config.awsRegion,
  });

  var params = {
    Marker: 'STRING_VALUE',
    MaxRecords: 'NUMBER_VALUE',
    ReplicationGroupId: 'STRING_VALUE'
  };

  const cluster = await ec.describeReplicationGroups({
    ReplicationGroupId: `biomage-redis-${clusterEnv}`
  }).promise();


  // biomage - redis - production
}


module.exports = {
  'eu-west-1': {
    master: {
      host: 'bic1ja6rekd5urqg-001.lmoszc.0001.euw2.cache.amazonaws.com',
      port: '6379',
      az: 'eu-west-1b',
    },
    slaves: [
      {
        host: 'bic1ja6rekd5urqg-002.lmoszc.0001.euw2.cache.amazonaws.com',
        port: '6379',
        az: 'eu-west-1a',
      },
    ],
  },
};
