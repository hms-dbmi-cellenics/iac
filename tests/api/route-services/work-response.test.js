/* eslint-disable consistent-return */
const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const WorkResponseService = require('../../../src/api/route-services/work-response');
const { handlePagination } = require('../../../src/utils/handlePagination');

jest.mock('../../../src/utils/handlePagination', () => ({
  handlePagination: jest.fn(),
}));

jest.mock('../../../src/utils/logging');

jest.mock('../../../src/utils/cache-request', () => ({
  cacheSetResponse: jest.fn(),
  cacheGetRequest: jest.fn(),
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

const s3Object = {
  AcceptRanges: 'bytes',
  LastModified: '2020-05-09T13:51:33.000Z',
  ContentLength: 223889,
  ETag: '"1aaac7d75617d2eea36c3d11de3106ec"',
  ContentEncoding: 'utf-8',
  ContentType: 'application/json',
  Metadata: {},
  Body: 'my amazing body',
};

AWSMock.setSDKInstance(AWS);
const getObjectSpy = jest.fn((x) => x);

describe('tests for the work-response service', () => {
  beforeEach(() => {
    setIoMock();
  });
  afterEach(() => {
    AWSMock.restore('S3');
    jest.resetModules();
    jest.restoreAllMocks();
    getObjectSpy.mockReset();
  });

  it('Throws during validation if invalid data is supplied', async (done) => {
    try {
      // eslint-disable-next-line no-unused-vars
      const w = new WorkResponseService(null, {});
    } catch (e) {
      expect(e.message).toEqual('Error: Unable to validate an empty value for property: rootModel');
      return done();
    }
  });

  it('Throws during handling response if the timeout has expired', async () => {
    const workResponse = {
      request: {
        uuid: '55',
        socketId: 'mysocketid',
        experimentId: '5e959f9c9f4b120771249001',
        timeout: '2001-01-01T00:00:00Z',
        body: {
          name: 'GetEmbedding',
          type: 'pca',
        },
      },
      results: [
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: '[[-17.86727523803711, 4.7951226234436035], [2.4647858142852783, -4.940079689025879]]',
          type: 'inline',
        },
      ],
    };
    const wr = new WorkResponseService(null, workResponse);
    await wr.handleResponse();
    expect(emitSpy).toHaveBeenCalledTimes(0);
  });

  it('Can consume work response with a single inline item', async (done) => {
    const workResponse = {
      request: {
        uuid: '55',
        socketId: 'mysocketid',
        experimentId: '5e959f9c9f4b120771249001',
        timeout: '2099-01-01T00:00:00Z',
        body: {
          name: 'GetEmbedding',
          type: 'pca',
        },
      },
      results: [
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: '[[-17.86727523803711, 4.7951226234436035], [2.4647858142852783, -4.940079689025879]]',
          type: 'inline',
        },
      ],
    };
    const w = new WorkResponseService(io, workResponse);
    const expectedResponse = JSON.parse(JSON.stringify(workResponse));
    delete expectedResponse.results[0].type;

    w.handleResponse().then(() => {
      expect(toSpy).toHaveBeenCalledTimes(1);
      expect(toSpy).toHaveBeenCalledWith('mysocketid');
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith('WorkResponse-55', expectedResponse);
      return done();
    });
  });

  it('Can consume work response with multiple inline items', async (done) => {
    const workResponse = {
      request: {
        uuid: '55',
        socketId: 'mysocketid',
        experimentId: '5e959f9c9f4b120771249001',
        timeout: '2099-01-01T00:00:00Z',
        body: {
          name: 'GetEmbedding',
          type: 'pca',
        },
      },
      results: [
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: '[[-17.86727523803711, 4.7951226234436035], [2.4647858142852783, -4.940079689025879]]',
          type: 'inline',
        },
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: '[[-17, 5], [45, -8]]',
          type: 'inline',
        },
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: '[[-1, 4], [2, -4], [3, 4]]',
          type: 'inline',
        }],
    };
    const w = new WorkResponseService(io, workResponse);
    const expectedResponse = JSON.parse(JSON.stringify(workResponse));
    expectedResponse.results
      .forEach((res) => delete res.type);

    w.handleResponse().then(() => {
      expect(toSpy).toHaveBeenCalledTimes(1);
      expect(toSpy).toHaveBeenCalledWith('mysocketid');
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith('WorkResponse-55', expectedResponse);
      return done();
    });
  });

  it('Can consume work response with a single processS3PathType item', async (done) => {
    const workResponse = {
      request: {
        uuid: '55',
        socketId: 'mysocketid',
        experimentId: '5e959f9c9f4b120771249001',
        timeout: '2099-01-01T00:00:00Z',
        body: {
          name: 'GetEmbedding',
          type: 'pca',
        },
      },
      results: [
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: 'worker-results-staging/509520fe-d329-437d-8752-b5868ad59425/48637d30-a88d-481e-b8cc-5eedd7e3af1c',
          type: 's3-path',
        },
      ],
    };
    AWSMock.mock('S3', 'getObject', (params, callback) => {
      getObjectSpy(params);
      callback(null, s3Object);
    });
    const w = new WorkResponseService(io, workResponse);
    const expectedResponse = JSON.parse(JSON.stringify(workResponse));
    delete expectedResponse.results[0].type;
    expectedResponse.results[0].body = 'my amazing body';

    w.handleResponse().then(() => {
      expect(toSpy).toHaveBeenCalledTimes(1);
      expect(toSpy).toHaveBeenCalledWith('mysocketid');
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith('WorkResponse-55', expectedResponse);
      expect(getObjectSpy).toHaveBeenCalledTimes(1);
      expect(getObjectSpy).toHaveBeenCalledWith(
        {
          Bucket: 'worker-results-staging',
          Key: '509520fe-d329-437d-8752-b5868ad59425/48637d30-a88d-481e-b8cc-5eedd7e3af1c',
          ResponseContentType: 'application/json',
          ResponseContentEncoding: 'utf-8',
        },
      );
      return done();
    });
  });

  it('Can consume work response with different types of items', async (done) => {
    const workResponse = {
      request: {
        uuid: '55',
        socketId: 'mysocketid',
        experimentId: '5e959f9c9f4b120771249001',
        timeout: '2099-01-01T00:00:00Z',
        body: {
          name: 'GetEmbedding',
          type: 'pca',
        },
      },
      results: [
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: 'worker-results-staging/509520fe-d329-437d-8752-b5868ad59425/48637d30-a88d-481e-b8cc-5eedd7e3af1c',
          type: 's3-path',
        },
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: '[[-17.86727523803711, 4.7951226234436035], [2.4647858142852783, -4.940079689025879]]',
          type: 'inline',
        },
      ],
    };
    AWSMock.mock('S3', 'getObject', (params, callback) => {
      getObjectSpy(params);
      callback(null, s3Object);
    });
    const w = new WorkResponseService(io, workResponse);
    const expectedResponse = JSON.parse(JSON.stringify(workResponse));
    expectedResponse.results
      .forEach((res) => delete res.type);
    expectedResponse.results[0].body = 'my amazing body';

    w.handleResponse().then(() => {
      expect(toSpy).toHaveBeenCalledTimes(1);
      expect(toSpy).toHaveBeenCalledWith('mysocketid');
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith('WorkResponse-55', expectedResponse);
      expect(getObjectSpy).toHaveBeenCalledTimes(1);
      expect(getObjectSpy).toHaveBeenCalledWith(
        {
          Bucket: 'worker-results-staging',
          Key: '509520fe-d329-437d-8752-b5868ad59425/48637d30-a88d-481e-b8cc-5eedd7e3af1c',
          ResponseContentType: 'application/json',
          ResponseContentEncoding: 'utf-8',
        },
      );
      return done();
    });
  });

  it('Can produce paginated work response', async (done) => {
    const pagination = {
      orderBy: 'qval',
      orderDirection: 'ASC',
      offset: 0,
      limit: 50,
      responseKey: 0,
    };
    const workResponse = {
      request: {
        uuid: '31773720-f17d-4214-ab47-9025518cd444',
        socketId: '0g-7oXVVok9brYMGAAAg',
        experimentId: '5e959f9c9f4b120771249001',
        timeout: '2020-08-17T08:17:52.026Z',
        body: {
          name: 'DifferentialExpression',
          cellSet: 'louvain-0',
          compareWith: 'louvain-1',
        },
        pagination,
      },
      results: [
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: '{"rows": [{"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "A"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "B"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "C"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "D"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "E"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "F"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "G"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "H"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "I"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "J"}]}',
          type: 'inline',
        },
      ],
    };

    const w = new WorkResponseService(io, workResponse);
    const expectedResponse = JSON.parse(JSON.stringify(workResponse));
    expectedResponse.results
      .forEach((res) => delete res.type);
    expectedResponse.results[0].body = 'my amazing body';

    w.handleResponse().then(() => {
      expect(handlePagination).toHaveBeenCalledTimes(1);
      expect(handlePagination).toHaveBeenCalledWith([
        {
          'content-type': 'application/json',
          'content-encoding': 'utf-8',
          body: '{"rows": [{"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "A"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "B"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "C"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "D"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "E"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "F"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "G"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "H"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "I"}, {"pval": 0.2, "qval": 0.3, "log2fc": 2.4, "gene_names": "J"}]}',
        },
      ], pagination);
      return done();
    });
  });
});
