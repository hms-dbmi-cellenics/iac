const hash = require('object-hash');
const cache = require('../cache');

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
  const payload = await cache.get(key);

  if (payload) {
    return payload;
  }

  throw new CacheMissError(`No cache entry found for ${data} at key ${key}`);
};


const cacheSetResponse = async (data, ttl = 900) => {
  const key = createObjectHash({
    experimentId: data.request.experimentId,
    body: data.request.body,
  });
  await cache.set(key, data, ttl);
};

module.exports = { cacheGetRequest, cacheSetResponse, CacheMissError };
