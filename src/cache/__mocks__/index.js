const _ = require('lodash');
const { BASE_CONFIG } = require('../generate-config');
const { CacheMissError } = require('../cache-utils');

const CacheMock = jest.fn().mockImplementation((conf, initialState) => {
  const state = _.cloneDeep(initialState);

  const get = jest.fn((key) => {
    const result = state[key];

    if (result) {
      return result;
    }

    throw new CacheMissError(`Cache miss on ${key}`);
  });

  const set = jest.fn((key, data) => {
    state[key] = data;
    return null;
  });

  const mockGetItems = () => state;

  return { get, set, mockGetItems };
});

const CacheMockSingleton = (() => {
  let instance;

  return {
    createMock: (initialState, conf = BASE_CONFIG) => {
      instance = CacheMock(conf, initialState);
      return instance;
    },

    get: (conf) => {
      if (!instance) {
        throw new Error('The mock has not been initialized. Call `.createMock(initialState, conf)` first.');
      }

      if (conf !== instance.conf) {
        throw new Error('The configuration specified does not match the instance configuration.');
      }

      return instance;
    },
  };
})();

module.exports = CacheMockSingleton;
