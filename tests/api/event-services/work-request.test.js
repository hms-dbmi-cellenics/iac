const handleWorkRequest = require('../../../src/api/event-services/work-request');
const handlePagination = require('../../../src/utils/handlePagination');
const CacheSingleton = require('../../../src/cache');

let mockCacheKey;

jest.mock('../../../src/utils/handlePagination');
jest.mock('../../../src/cache', () => ({
  get: jest.fn((key) => {
    if (key === mockCacheKey) {
      return {
        results: [
          {
            body: JSON.stringify({
              rows:
                [
                  {
                    name: 'z',
                  },
                  {
                    name: 'c',
                  },
                  {
                    name: 'a',
                  },
                ],
            }),
          },
        ],
      };
    }
    return null;
  }),
  set: jest.fn(),
}));

let io;
let emitSpy;
let toSpy;

const setIoMock = () => {
  emitSpy = jest.fn();

  const mockEmit = {
    emit: emitSpy,
  };
  toSpy = jest.fn(() => mockEmit);

  io = {
    to: toSpy,
    emit: emitSpy,
  };
};


describe('tests for handleWorkRequest', () => {
  beforeEach(() => {
    setIoMock();
  });


  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });


  it('Throws when an old timeout is encountered.', async () => {
    mockCacheKey = 'notThere';
    expect.assertions(1);

    const workRequest = {
      uuid: '12345',
      socketId: '6789',
      experimentId: 'my-experiment',
      timeout: '2001-01-01T00:00:00Z',
      body: { name: 'GetEmbedding', type: 'tsne' },
    };

    try {
      // eslint-disable-next-line no-unused-vars
      const w = await handleWorkRequest(workRequest, io);
    } catch (e) {
      expect(e.message).toMatch(
        /^Work request will not be handled as timeout/,
      );
    }
  });

  it('Triggers pagination when pagination is specified and result is cached already.', async () => {
    mockCacheKey = '60c032929784c904d0276967cb920b57';
    const workRequest = {
      uuid: '12345',
      socketId: '6789',
      experimentId: 'my-experiment',
      timeout: '2099-01-01T00:00:00Z',
      body: {
        name: 'DifferentialExpression', cellSet: 'louvain-0', compareWith: 'rest', maxNum: 500,
      },
      pagination: {
        orderBy: 'name',
        orderDirection: 'ASC',
        offset: 0,
        limit: 5,
        responseKey: 0,
      },
    };

    await handleWorkRequest(workRequest, io);
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(handlePagination.handlePagination).toHaveBeenCalledTimes(1);
  });
});
