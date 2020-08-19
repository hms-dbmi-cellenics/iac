const sanitiseGlobalConfiguration = require('../../src/cache/sanitiser');

jest.mock('../../src/config');

describe('sanitiser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitise global configuration', () => {
    let configuration;

    afterEach(() => expect(configuration).toMatchSnapshot());

    it('sanitise if no config provided, dev env', () => {
      configuration = sanitiseGlobalConfiguration({});
    });

    it('sanitise to default retry delay if delay is smaller then default', () => {
      configuration = sanitiseGlobalConfiguration({ retryDelay: 1 });
    });

    it('sanitise to new retry delay if delay is bigger then default', () => {
      configuration = sanitiseGlobalConfiguration({ retryDelay: 20000 });
    });

    it('sanitise with overridden skipAvailabilityZoneCheck', () => {
      configuration = sanitiseGlobalConfiguration({ skipAvailabilityZoneCheck: true });
    });

    it('sanitises the l1CacheSettings using the default values, when it\'s empty', () => {
      configuration = sanitiseGlobalConfiguration({ l1CacheSettings: {} });
    });

    it('sanitises the l1CacheSettings using the default values, when it\'s invalid', () => {
      configuration = sanitiseGlobalConfiguration({
        l1CacheSettings: {
          size: 'invalid',
          ttl: 'invalid',
          minLatencyToStore: 'invalid',
        },
      });
    });

    it('sanitises the l1CacheSettings - uses the provided config when valid', () => {
      configuration = sanitiseGlobalConfiguration({
        l1CacheSettings: {
          size: '2000',
          ttl: 120,
          minLatencyToStore: 10,
        },
      });
    });

    it('sanitises the l1CacheSettings - uses the provided config when valid (minLatencyToStore=0)', () => {
      configuration = sanitiseGlobalConfiguration({
        l1CacheSettings: {
          size: '2000',
          ttl: 120,
          minLatencyToStore: 0,
        },
      });
    });
  });
});
