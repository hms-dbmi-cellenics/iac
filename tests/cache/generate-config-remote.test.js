/* eslint-disable consistent-return */
const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const mockConfig = require('../../src/config/__mocks__/index');
const { BASE_CONFIG, generateConfig } = require('../../src/cache/generate-config');

jest.mock('../../src/utils/logging');
jest.mock('../../src/config', () => ({
  ...mockConfig, clusterEnv: 'staging',
}));

describe('generateConfig (remote)', () => {
  beforeAll(() => {
    AWSMock.setSDKInstance(AWS);
  });

  it('Fetches replication group details from AWS in remote', async () => {
    AWSMock.mock('ElastiCache', 'describeReplicationGroups', (params, callback) => {
      expect(params.ReplicationGroupId).toEqual('biomage-redis-staging');
      callback(null, {
        ReplicationGroups: [{
          NodeGroups: [{
            PrimaryEndpoint: {
              Address: 'a',
              Port: 6969,
            },
            ReaderEndpoint: {
              Address: 'b',
              Port: 4200,
            },
          }],
        }],
      });
    });

    const conf = await generateConfig();
    expect(conf).toEqual({ ...BASE_CONFIG, primary: { host: 'a', port: 6969 }, reader: { host: 'b', port: 4200 } });
  });
});
