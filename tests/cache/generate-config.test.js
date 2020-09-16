/* eslint-disable consistent-return */
const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');

jest.mock('../../../src/utils/logging');
jest.mock('../../../src/cache');

describe('generateConfig (cache)', () => {
  beforeAll(() => {
  });

  beforeEach(() => {
  });

  afterEach(() => {
    AWSMock.restore();
  });

  it('Throws during validation if invalid data is supplied', async () => {
  });
});
