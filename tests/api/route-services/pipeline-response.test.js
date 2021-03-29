const AWSMock = require('aws-sdk-mock');
const ioClient = require('socket.io-client');
const ioServer = require('socket.io')({
  allowEIO3: true,
});
const AWS = require('../../../src/utils/requireAWS');
const pipelineResponse = require('../../../src/api/route-services/pipeline-response');

jest.mock('../../../src/api/general-services/pipeline-status', () => jest.fn().mockImplementation(() => ({
  pipelineStatus: () => ({}),
})));

const mockDynamoGetItem = (jsData) => {
  const dynamodbData = {
    Item: AWS.DynamoDB.Converter.marshall(jsData),
  };
  const getItemSpy = jest.fn((x) => x);
  AWSMock.setSDKInstance(AWS);
  AWSMock.mock('DynamoDB', 'getItem', (params, callback) => {
    getItemSpy(params);
    callback(null, dynamodbData);
  });
  return getItemSpy;
};

describe('Test Pipeline Response Service', () => {
  let io;
  let client;

  const message = {
    input: {
      experimentId: '1234',
      taskName: 'cellSizeDistribution',
      sampleUuid: '',
    },
    output: {
      bucket: 'aws-bucket',
      key: '1234',
    },
    response: { error: false },
  };

  const s3output = {
    Body: JSON.stringify(
      {
        config: {
          enabled: true,
          filterSettings: {
            minCellSize: 10800,
            binStep: 200,
          },
        },
      },
    ),
  };

  const experimentId = '1234';

  beforeAll(() => {
    io = ioServer.listen(3001);
  });

  beforeEach(() => {
    AWSMock.setSDKInstance(AWS);
    client = ioClient.connect('http://localhost:3001', {
      'reconnection delay': 0,
      'reopen delay': 0,
      'force new connection': true,
      transports: ['websocket'],
    });
  });

  afterEach(() => {
    AWSMock.restore();

    if (client.connected) {
      client.disconnect();
    }
  });

  afterAll(() => {
    io.close();
  });

  it('functions propely with correct input (no sample UUID given)', async () => {
    AWSMock.setSDKInstance(AWS);

    const s3Spy = jest.fn((x) => x);
    AWSMock.mock('S3', 'getObject', (params, callback) => {
      s3Spy(params);
      callback(null, s3output);
    });

    const dynamoDbSpy = jest.fn((x) => x);
    AWSMock.mock('DynamoDB', 'updateItem', (params, callback) => {
      dynamoDbSpy(params);
      callback(null, {});
    });


    mockDynamoGetItem({
      processingConfig: {
        cellSizeDistribution: {
          filterSettings: { binStep: 200, minCellSize: 420 }, enabled: true,
        },
      },
    });

    // Expect websocket event
    client.on(`ExperimentUpdates-${experimentId}`, (res) => {
      expect(res).toEqual(message);
    });

    await pipelineResponse(io, message);

    // Download output from S3
    expect(s3Spy).toHaveBeenCalled();

    // Update processing settings in dynamoDB
    expect(dynamoDbSpy).toMatchSnapshot();
  });

  it('functions propely with correct input (custom sample UUID given)', async () => {
    AWSMock.setSDKInstance(AWS);

    const s3Spy = jest.fn((x) => x);
    AWSMock.mock('S3', 'getObject', (params, callback) => {
      s3Spy(params);
      callback(null, s3output);
    });

    const dynamoDbSpy = jest.fn((x) => x);
    AWSMock.mock('DynamoDB', 'updateItem', (params, callback) => {
      dynamoDbSpy(params);
      callback(null, {});
    });


    mockDynamoGetItem({
      processingConfig: {
        cellSizeDistribution: {
          filterSettings: { binStep: 200, minCellSize: 420 }, enabled: true,
        },
      },
    });

    // Expect websocket event
    client.on(`ExperimentUpdates-${experimentId}`, (res) => {
      expect(res).toEqual(message);
    });

    await pipelineResponse(io, { ...message, input: { ...message.input, sampleUuid: 'control' } });

    // Download output from S3
    expect(s3Spy).toHaveBeenCalled();

    // Update processing settings in dynamoDB
    expect(dynamoDbSpy).toMatchSnapshot();
  });

  it('throws error on receiving error in message', async () => {
    const errorMessage = message;
    errorMessage.response.error = true;

    AWSMock.setSDKInstance(AWS);

    const s3Spy = jest.fn((x) => x);
    AWSMock.mock('S3', 'getObject', (params, callback) => {
      s3Spy(params);
      callback(null, s3output);
    });

    const dynamoDbSpy = jest.fn((x) => x);
    AWSMock.mock('DynamoDB', 'updateItem', (params, callback) => {
      dynamoDbSpy(params);
      callback(null, {});
    });


    // Expect websocket event
    client.on(`ExperimentUpdates-${experimentId}`, (res) => {
      expect(res).toEqual(errorMessage);
    });

    await pipelineResponse(io, errorMessage);

    expect(s3Spy).not.toHaveBeenCalled();
    expect(dynamoDbSpy).not.toHaveBeenCalled();
  });
});
