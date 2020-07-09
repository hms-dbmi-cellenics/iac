const lruCache = require('lru-cache');
const Redis = require('ioredis-mock');
const logger = require('../../src/utils/logging');
const cache = require('../../src/cache');

const redis = new Redis({
  data: {
    existInRedis: { result: 'valueInRedis' },
  },
});

cache.redisClient.master.redis = redis;
cache.redisClient.slave.redis = redis;

jest.mock('../../src/utils/logging', () => ({
  trace: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../../src/cache/redis-client', () => jest.fn(() => ({
  createClient: jest.fn(),
  master: {
    isHealthy: true,
    checkStatus: jest.fn(),
  },
  slave: {
    isHealthy: true,
    checkStatus: jest.fn(),
  },
})));

jest.mock('lru-cache', () => jest.fn().mockImplementation(() => ({
  get: jest.fn((key) => {
    if (key === 'existInL1') return { result: 'valueInL1' };
    return null;
  }),
  set: jest.fn(),
})));

jest.mock('../../src/cache/aws-utilities', () => jest.fn((value) => new Promise((resolve, reject) => {
  if (value === 'placement/availability-zone') {
    resolve('eu-west-2b');
  } else {
    reject(new Error('error'));
  }
})));

describe('cache', () => {
  beforeEach(() => {
    cache.redisClient.master.isHealthy = true;
    cache.redisClient.slave.isHealthy = true;
  });
  it('hits l1 cache and returns value', async () => {
    const result = await cache.get('existInL1');
    expect(result).toMatchObject({ responseFrom: 'l1Cache', result: 'valueInL1' });
    expect(lruCache).toHaveBeenCalledWith({
      max: 1000,
      maxAge: 60000,
      stale: true,
    });
    expect(cache.l1Cache.get).toHaveBeenCalledWith('existInL1');
  });
  it('miss l1 cache and returns value from Redis cache', async () => {
    const result = await cache.get('existInRedis');
    expect(result).toMatchObject({ responseFrom: 'redis', result: 'valueInRedis' });
  });
  it('will set the value in cache correctly', async () => {
    const result = await cache.set('key1', 'value1');
    expect(result).toBe(undefined);
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.error).toHaveBeenCalledTimes(0);
  });
  it('will check cache status if get fails', async () => {
    cache.redisClient.slave.isHealthy = false;
    const result = await cache.get('existInRedis');
    expect(result).toBe(null);
    expect(cache.redisClient.slave.checkStatus).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
  it('will not set the value in cache if master is not healthy', async () => {
    cache.redisClient.master.isHealthy = false;
    const result = await cache.set('key1', 'value1');
    expect(result).toBe(undefined);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
