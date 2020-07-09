const Redis = require('ioredis');
const logger = require('../../src/utils/logging');
const RedisWrapper = require('../../src/cache/redis-wrapper');

jest.mock('ioredis', () => jest.fn(() => ({
  on: jest.fn(),
  connect: jest.fn(() => Promise.resolve()),
})));

jest.mock('../../src/utils/logging', () => ({
  trace: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const clock = jest.useFakeTimers();

const createRedis = () => new RedisWrapper({
  host: 'host',
  port: 123,
  retryDelay: 10000,
});

describe('Redis Client', () => {
  afterEach(() => {
    clock.clearAllMocks();
    Redis.mockClear();
  });
  it('Client is not healthy when been created', async () => {
    const redis = createRedis();
    expect(redis.isHealthy).toEqual(false);
    expect(Redis.mock.calls[0])
      .toEqual([{
        host: 'host', lazyConnect: true, port: 123, retryStrategy: expect.any(Function),
      }]);
    expect(Redis.mock.calls.length).toEqual(1);
    jest.runOnlyPendingTimers();
    expect(redis.redis.connect.mock.calls.length).toBe(1);
    expect(logger.error).toHaveBeenCalledTimes(0);
  });
  it('Client health check is failing, when redis connection is down and client was healthy previously', () => {
    const redisWrapper = createRedis();
    redisWrapper.redis.status = 'end';
    redisWrapper.isHealthy = true;
    redisWrapper.checkStatus();
    expect(redisWrapper.redis.status).toBe('end');
    expect(redisWrapper.isHealthy).toBe(false);
    jest.runOnlyPendingTimers();
    expect(redisWrapper.redis.connect.mock.calls.length).toBe(2);
    expect(setInterval.mock.calls.length).toBe(2);
    expect(setInterval.mock.calls[1][1]).toBe(10000);
  });
  it('Client reconnect, when redis connection is up', () => {
    const redis = createRedis();
    redis.connectRedis();
    jest.runOnlyPendingTimers();
    expect(redis.redis.connect.mock.calls.length).toBe(2);
    expect(setInterval.mock.calls.length).toBe(2);
    expect(setInterval.mock.calls[1][1]).toBe(10000);
  });
  it('Client reconnect wont happen, when redis connection is down and isHealthy=false', () => {
    const redisWrapper = createRedis();
    redisWrapper.redis.status = 'end';
    redisWrapper.isHealthy = false;
    redisWrapper.checkStatus();
    jest.runOnlyPendingTimers();
    expect(redisWrapper.redis.connect.mock.calls.length).toBe(1);
    expect(setInterval.mock.calls.length).not.toBe(2);
  });

  it('Client reconnect will keep retrying if redis connect fails', () => {
    const redisWrapper = createRedis();
    jest.runOnlyPendingTimers();
    expect(redisWrapper.redis.connect.mock.calls.length).toBe(1);
    expect(setInterval.mock.calls.length).toBe(1);
  });

  it('Client reconnect will keep retrying if checkStatus calls before reconect call', () => {
    const redisWrapper = createRedis();
    redisWrapper.redis.status = 'connecting';
    redisWrapper.isHealthy = true;
    redisWrapper.checkStatus();
    redisWrapper.connectRedis();
    jest.runOnlyPendingTimers();
    expect(redisWrapper.redis.connect.mock.calls.length).toBe(3);
    expect(setInterval.mock.calls.length).toBe(3);
  });
});
