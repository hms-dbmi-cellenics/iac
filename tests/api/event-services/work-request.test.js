const handleWorkRequest = require('../../../src/api/event-services/work-request');
const cacheRequest = require('../../../src/utils/cache-request');
const handlePagination = require('../../../src/utils/handlePagination');

jest.mock('../../../src/utils/handlePagination');
jest.mock('../../../src/utils/cache-request', () => ({
  cacheGetRequest: jest.fn().mockResolvedValue({
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
  }),
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
    expect.assertions(1);

    const workRequest = {
      uuid: '12345',
      socketId: '6789',
      experimentId: 'my-experiment',
      timeout: '2001-01-01T00:00:00Z',
      body: { name: 'GetEmbedding', type: 'pca' },
    };

    try {
      // eslint-disable-next-line no-unused-vars
      const w = await handleWorkRequest(workRequest);
    } catch (e) {
      expect(e.message).toMatch(
        /^Work request will not be handled as timeout/,
      );
    }
  });

  it('Triggers pagination when pagination is specified and result is cached already.', async () => {
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
    expect(cacheRequest.cacheGetRequest).toHaveBeenCalledTimes(1);
    expect(handlePagination.handlePagination).toHaveBeenCalledTimes(1);
  });
});
