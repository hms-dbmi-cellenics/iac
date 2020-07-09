module.exports = {
  'eu-west-2': {
    master: {
      host: 'bic1ja6rekd5urqg-001.lmoszc.0001.euw2.cache.amazonaws.com',
      port: '6379',
      az: 'eu-west-2b',
    },
    slaves: [
      {
        host: 'bic1ja6rekd5urqg-002.lmoszc.0001.euw2.cache.amazonaws.com',
        port: '6379',
        az: 'eu-west-2a',
      },
    ],
  },
};
