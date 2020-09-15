const Redis = require('ioredis-mock');
const _ = require('lodash');
const cache = require('../../src/cache');
const { cacheGetRequest } = require('../../src/utils/cache-request');

const redis = new Redis({
  data: {
    existInRedis: JSON.stringify({ result: 'valueInRedis' }),
  },
});

cache.redisClient.master.redis = redis;
cache.redisClient.slave.redis = redis;

jest.mock('../../src/utils/logging');

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

const mockRequest = {
  uuid: 'requestUuid',
  socketId: 'socketio.id',
  experimentId: 'experimentId',
  timeout: 6000,
  body: {
    name: 'ListGenes',
    selectFields: ['gene_names', 'dispersions'],
    orderBy: 'name',
    orderDirection: 'ASC',
    offset: 10,
    limit: 15,
  },
};

const mockResponse = {
  request: mockRequest,
  result: ['some result'],
};

// This is a simple mock of the lru cache, which returns and stores REFERENCES to originals,
// not copies.
jest.mock('lru-cache', () => jest.fn().mockImplementation(() => ({
  get: jest.fn(() => mockResponse),
  set: jest.fn(),
})));

jest.mock('../../src/cache/aws-utilities', () => jest.fn((value) => new Promise((resolve, reject) => {
  if (value === 'placement/availability-zone') {
    resolve('eu-west-1b');
  } else {
    reject(new Error('error'));
  }
})));

describe('cache-request behavior under lru-cache', () => {
  beforeAll(() => {
    jest.spyOn(cache, '_redisGet').mockImplementation(() => null);
  });
  beforeEach(() => {
    cache.redisClient.master.isHealthy = true;
    cache.redisClient.slave.isHealthy = true;
  });
  it('will return a copy (clone) of a value stored in l1', async () => {
    // First, we get something from the l1 cache.
    const firstResult = await cacheGetRequest(mockRequest, jest.fn(), jest.fn());
    // Assert that we got this from the mocked l1Cache.
    expect(firstResult.responseFrom).toEqual('l1Cache');
    // Save a copy of it.
    const resultSnapshot = _.cloneDeep(firstResult);
    // Modify the one returned from `cacheGetRequest`.
    firstResult.result[0] = 'some other string';
    // Get the same thing from the l1 cache again.
    const secondResult = await cacheGetRequest(mockRequest, jest.fn(), jest.fn());
    // Assert that we got this from the mocked l1Cache as well.
    expect(secondResult.responseFrom).toEqual('l1Cache');
    // The returned value should not have changed.
    expect(secondResult).toEqual(resultSnapshot);
  });
});
