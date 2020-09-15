const hash = require('object-hash');

const CacheSingleton = require('../cache');
const logger = require('./logging');

const createObjectHash = (object) => hash.MD5(object);

class CacheMissError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

const cacheGetRequest = async (
  data,
) => {
  const key = createObjectHash({
    experimentId: data.experimentId,
    body: data.body,
  });

  logger.log(`Looking up data in cache under key ${key}`);

  const payload = await CacheSingleton.get(key);

  if (payload) {
    return payload;
  }

  throw new CacheMissError(`No cache entry found for key ${key}`);
};


const cacheSetResponse = async (data, ttl = 900) => {
  const key = createObjectHash({
    experimentId: data.request.experimentId,
    body: data.request.body,
  });

  logger.log(`Putting data in cache under key ${key}`);

  await CacheSingleton.set(key, data, ttl);
};

module.exports = { cacheGetRequest, cacheSetResponse, CacheMissError };
