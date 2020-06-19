/* eslint-disable consistent-return */
/* eslint-env jest */
const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const WorkResponseService = require('../../../src/api/route-services/work-response');

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

describe('tests for the work-response service', () => {
  beforeEach(() => {
    setIoMock();
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

  it('Throws during validation if the timeout has expired', async (done) => {
    try {
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

      // eslint-disable-next-line no-unused-vars
      const w = new WorkResponseService(null, workResponse);
    } catch (e) {
      expect(e.message).toMatch(
        /^Work response will not be handled as timeout/,
      );
      return done();
    }
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
        },
      ],
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

  afterEach(() => {
    AWSMock.restore('S3');
    jest.resetModules();
    jest.restoreAllMocks();
  });
});
