const Redis = require('ioredis');
const logger = require('../utils/logging');

const createClient = (options) => {
  const { host, port, endpoint } = options;

  const redis = new Redis({
    host,
    port,
    reconnectOnError: (err) => {
      const targetError = 'READONLY';

      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        // Once failover happens on ElastiCache, the reader will
        // become the master, causing a READONLY error. Force
        // reconnection so we connect to the new master.
        return true;
      }

      return false;
    },
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error(`redis:${endpoint}`, 'Failed to establish connection.');
        return false;
      }

      const delay = Math.min(times * 1000, 3000);
      return delay;
    },
  });

  redis.on('connect', () => {
    logger.log(`redis:${endpoint}`, 'Connection successfully established.');
  });

  redis.on('ready', () => {
    logger.log(`redis:${endpoint}`, 'Connection ready.');
  });

  redis.on('error', (error) => {
    logger.error(`redis:${endpoint}`, 'An error occurred:', error.message);
  });

  return redis;
};

module.exports = createClient;
