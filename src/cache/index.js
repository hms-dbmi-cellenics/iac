/* eslint-disable no-underscore-dangle */
const _ = require('lodash');
const createMemCache = require('./mem-cache');
const createClient = require('./createClient');
const timeout = require('./timeout');
const { now, bypassCache } = require('./cache-utils');
const logger = require('../utils/logging');

class Cache {
  constructor(conf) {
    this.conf = conf;

    // If l1CacheSettings is defined, we will set it up.
    this.l1Cache = bypassCache;

    const { l1CacheSettings } = this.conf;
    if (l1CacheSettings) {
      const { size, ttl } = l1CacheSettings;

      logger.log(`Setting up L1 (in-memory) cache, size: ${size}, TTL: ${ttl}`);
      this.l1Cache = createMemCache({ size, ttl });

      if (!this.l1Cache) {
        logger.log('L1 cache could not be loaded. Bypassing...');
        this.l1Cache = bypassCache;
      }
    }

    logger.log('Now setting up Redis connections...');

    const endpoints = ['primary', 'reader'];
    const connections = endpoints.map((endpoint) => {
      const { host, port } = this.conf[endpoint];
      const { retryDelay } = this.conf;

      return createClient({
        host, port, retryDelay, endpoint,
      });
    });

    this.clients = Object.fromEntries(_.zip(endpoints, connections));

    return this;
  }


  getClientAndStatus(endpoint) {
    const client = this.clients[endpoint];
    if (!client) {
      return { status: 'invalid endpoint name', ready: false };
    }

    const { status } = client;
    return {
      client, status, ready: status === 'ready',
    };
  }

  // set value should not be used independently as it might cause cache poisoning
  async set(key, data, ttl) {
    if (ttl <= 0) return;
    const { cacheDuration } = this.configuration;
    const { client, status, ready } = this.getClientAndStatus('primary');

    if (!ready) {
      logger.warn('redis:primary', `Cannot SETEX to ${key} as client is in status ${status}`);
      return;
    }

    try {
      // IMPORTANT: the data that is set to the cache MUST be stringified,
      // because setex does not support setting objects.
      const stringifiedData = JSON.stringify(data);
      await client.setex(key, ttl || cacheDuration, stringifiedData);
    } catch (error) {
      logger.error();
      logger.error(`redis:primary Cannot SETEX from ${key} as an error occurred: ${error.message}`);
      logger.error();
    }
  }

  async _redisGet(key) {
    const { client, status, ready } = this.getClientAndStatus('primary');

    if (!ready) {
      const message = `redis:reader Cannot GET from ${key} as client is in status ${status}`;
      logger.warn(message);
      throw new Error(message);
    }

    try {
      let result;

      if (this.configuration.redisGetTimeout) {
        result = await Promise.race([timeout(this.configuration.redisGetTimeout), client.get(key)]);
      } else {
        result = await client.get(key);
      }

      // unstringify the data
      result = JSON.parse(result);
      return result;
    } catch (error) {
      const message = `redis:reader Cannot GET from ${key} as an error occurred: ${error.message}`;
      logger.error(message);
      throw new Error(message);
    }
  }

  async get(key) {
    // IMPORTANT: the l1 cache stores /references/, not /values/, so
    // the results you get from l1 MUST be cloned so it can be modified
    // downstream without modifying the cache at a given key.
    const requestDateTime = now();
    const l1Result = this.l1Cache.get(key);

    if (l1Result) {
      l1Result.responseFrom = 'l1Cache';
      return _.cloneDeep(l1Result);
    }

    try {
      const response = await this._redisGet(key, this.configuration);

      const cacheHitDuration = now() - requestDateTime;
      if (
        this.configuration.l1CacheSettings
        && (cacheHitDuration >= this.configuration.l1CacheSettings.minLatencyToStore)
      ) {
        this.l1Cache.set(key, response);
      }

      response.responseFrom = 'redis';
      return _.cloneDeep(response);
    } catch (error) {
      logger.error();
      logger.error(error, `Cache lookup for key ${key} failed.`);
      logger.error(error.message);
      logger.error();
    }

    return null;
  }

  isReady() {
    let ready = true;

    Object.values(this.clients).forEach((client) => {
      ready = ready && (client.status === 'ready');
    });

    return ready;
  }
}

const CacheSingleton = (() => {
  let instance;

  const createInstance = (conf) => {
    const object = new Cache(conf);
    return object;
  };

  return {
    get: (conf) => {
      if (!instance) {
        instance = createInstance(conf);
        return instance;
      }

      if (conf && conf !== instance.conf) {
        throw new Error('The configuration specified does not match the instance configuration.');
      }

      return instance;
    },
  };
})();

module.exports = CacheSingleton;
