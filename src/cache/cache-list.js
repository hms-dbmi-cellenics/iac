module.exports = {
  'eu-west-2': {
    master: {
      host: 'biomage-cache-001.lmoszc.0001.euw2.cache.amazonaws.com',
      port: '6379',
      az: 'eu-west-2b',
    },
    slaves: [
      {
        host: 'biomage-cache-002.lmoszc.0001.euw2.cache.amazonaws.com',
        port: '6379',
        az: 'eu-west-2b',
      },
    ],
  },
};
