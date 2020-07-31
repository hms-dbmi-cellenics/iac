const { cacheSetResponse, cacheGetRequest, CacheMissError } = require('../../src/utils/cache-request');
const cache = require('../../src/cache');

jest.mock('../../src/cache', () => ({
  get: jest.fn((key) => {
    if (key === '7b18513d240c9ad9dfd003a39a6be9fb') return { result: 'valueInL1' };
    return null;
  }),
  set: jest.fn(),
}));

const request = {
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

const response = {
  request,
  result: ['some result'],
};

const callback = jest.fn();
const socket = jest.fn();
const emit = jest.fn();
socket.to = jest.fn(() => ({
  emit,
}));

describe('cache', () => {
  afterEach(() => {
    callback.mockClear();
    socket.mockClear();
    socket.to.mockClear();
    emit.mockClear();
  });

  it('cacheGetRequest, cache miss', async () => {
    expect.assertions(3);

    let result;

    try {
      result = await cacheGetRequest(request, callback, socket);
    } catch (e) {
      expect(e).toBeInstanceOf(CacheMissError);
    }

    expect(cache.get).toHaveBeenCalledWith('6ae8b54798a716938d34ebea01d40307');
    expect(result).toBe(undefined);
  });

  it('cacheGetRequest, cache hit', async () => {
    const newRequest = { ...request, experimentId: 'newExperimentId' };
    const result = await cacheGetRequest(newRequest, callback, socket);
    expect(result).toEqual({ result: 'valueInL1' });
    expect(cache.get).toHaveBeenCalledWith('7b18513d240c9ad9dfd003a39a6be9fb');
  });

  it('cacheSetResponse', async () => {
    await cacheSetResponse(response);
    expect(cache.set).toHaveBeenCalledWith('6ae8b54798a716938d34ebea01d40307', {
      request,
      result: response.result,
    }, 900);
  });
});
