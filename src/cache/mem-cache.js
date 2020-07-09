const LruCache = require('lru-cache');

const createMemCache = ({ size, ttl }) => {
  const opt = {
    max: size,
    maxAge: ttl,
    stale: true,
  };
  return new LruCache(opt);
};

module.exports = createMemCache;
