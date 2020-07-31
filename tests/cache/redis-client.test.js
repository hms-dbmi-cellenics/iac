const logger = require('../../src/utils/logging');
const RedisClient = require('../../src/cache/redis-client');
const RedisWrapper = require('../../src/cache/redis-wrapper');

jest.mock('../../src/utils/logging');

jest.mock('../../src/cache/aws-utilities', () => jest.fn((value) => new Promise((resolve, reject) => {
  if (value === 'placement/availability-zone') {
    resolve('eu-west-2b');
  } else {
    reject(new Error('error'));
  }
})));

jest.mock('../../src/cache/redis-wrapper');

describe('Redis Client', () => {
  afterEach(() => {
    RedisWrapper.mockClear();
  });
  it('Creates client properly', async () => {
    const redisClient = new RedisClient({
      master: { host: 'host-master', port: 123, az: 'eu-west-1a' },
      slaves: [{
        host: 'host-slave', port: 321, az: 'eu-west-1b',
      }],
    });
    expect(redisClient).toBeDefined();
    expect(RedisWrapper.mock.calls[0]).toEqual([{ host: 'host-master', port: 123 }]);
    expect(RedisWrapper.mock.calls.length).toEqual(1);
    expect(logger.error).toHaveBeenCalledTimes(0);
  });
  it('Configures slave correctly', async () => {
    const redisClient = new RedisClient({
      master: { host: 'host-master', port: 123, az: 'eu-west-1a' },
      slaves: [{
        host: 'host-slave', port: 321, az: 'eu-west-1b',
      }],
    });
    await redisClient.tryReconfigureSlaveClient();
    expect(redisClient.master).toBeInstanceOf(RedisWrapper);
    expect(redisClient.slave).toBeInstanceOf(RedisWrapper);
    expect(logger.error).toHaveBeenCalledTimes(0);
  });
  it('Switches to master redis if slave configuration fails', async () => {
    const redisClient = new RedisClient({
      master: { host: 'host-master', port: 123, az: 'eu-west-1a' },
      slaves: [{
        host: 'host-slave', port: 321, az: 'eu-west-1b',
      }],
    });
    RedisClient.getSlave = jest.fn(() => {
      throw new Error(Error);
    });
    await redisClient.tryReconfigureSlaveClient();
    expect(redisClient.master).toBeInstanceOf(RedisWrapper);
    expect(redisClient.slave).toBeInstanceOf(RedisWrapper);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error.mock.calls[0][1]).toEqual('switching to master redis as failed to get availability zone');
  });
});
