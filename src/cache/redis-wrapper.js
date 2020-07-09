const Redis = require('ioredis');
const logger = require('../utils/logging');

class RedisWrapper {
  constructor(options) {
    this.host = options.host;
    this.port = options.port;
    this.isHealthy = false;
    this.retryStrategy = () => false;
    this.lazyConnect = true;
    this.retryDelay = options.retryDelay;
    this.redis = this.createClient();
  }

  connectRedis() {
    const refreshIntervalId = setInterval(() => {
      this.redis.connect().then(() => {
        this.isHealthy = true;
        clearInterval(refreshIntervalId);
      }).catch((error) => {
        logger.error(error, 'Failed to connect to redis server');
      });
    }, this.retryDelay);
  }

  checkStatus() {
    if (this.redis.status !== 'ready' && this.isHealthy) {
      this.isHealthy = false;
      this.connectRedis();
    }
  }

  createClient() {
    const redis = new Redis({
      host: this.host,
      port: this.port,
      retryStrategy: this.retryStrategy,
      lazyConnect: this.lazyConnect,
    });
    redis.on('error', (error) => {
      logger.error(error, 'Failed to create redis client');
    });
    this.connectRedis();
    return redis;
  }
}

module.exports = RedisWrapper;
