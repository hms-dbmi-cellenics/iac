/* eslint-env jest */
const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const WorkSubmitService = require('../../../src/api/general-services/work-submit');

jest.mock('../../../src/config');
jest.mock('@kubernetes/client-node');

describe('tests for the work-submit service', () => {
  it('Can submit work', async (done) => {
    const workRequest = {
      uuid: '12345',
      socketId: '6789',
      experimentId: 'my-experiment',
      timeout: '2099-01-01T00:00:00Z',
      body: { name: 'GetEmbedding', type: 'pca' },
    };

    AWSMock.setSDKInstance(AWS);
    const sendMessageSpy = jest.fn((x) => x);
    AWSMock.mock('SQS', 'sendMessage', (params) => {
      sendMessageSpy(params);
      return new Promise((resolve) => {
        resolve(sendMessageSpy);
      });
    });

    const w = new WorkSubmitService(workRequest);
    w.submitWork().then(() => {
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      expect(sendMessageSpy).toHaveBeenCalledWith(
        {
          MessageBody: JSON.stringify(workRequest),
          QueueUrl: 'https://sqs.eu-west-2.amazonaws.com/test-account-id/queue-job-14d3bd024bd5b20b53f5d3d9ab0db879267c7bf7-test.fifo',
          MessageGroupId: 'work',
        },
      );
      return done();
    });
  });

  afterEach(() => {
    AWSMock.restore('SQS');
    jest.resetModules();
    jest.restoreAllMocks();
  });
});
