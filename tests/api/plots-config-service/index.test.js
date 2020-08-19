const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const handlePlotConfigRequest = require('../../../src/api/plots-config-service');

jest.mock('../../../src/config');
jest.mock('../../../src/utils/logging');

const socket = jest.fn();
const emit = jest.fn();
socket.emit = emit;


describe('Test Plot Config Service', () => {
  afterEach(() => {
    socket.mockClear();
    emit.mockClear();
    AWSMock.restore('DynamoDB');
  });

  it('create operation, puts data in database', async () => {
    const workRequest = {
      uuid: '1',
      operation: 'create',
      plotName: 'plot1',
      experimentId: '1',
      body: { foo: 'bar', baz: [1, 2, 3] },
    };

    const putItem = jest.fn();
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('DynamoDB', 'putItem', (params, callback) => {
      putItem(params);
      callback(null, null);
    });
    await handlePlotConfigRequest(workRequest, socket);
    expect(putItem).toMatchSnapshot();
  });
  it('delete operation, delete data from database', async () => {
    const workRequest = {
      uuid: '1',
      operation: 'delete',
      plotName: 'plot1',
      experimentId: '1',
    };

    const deleteItem = jest.fn();
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('DynamoDB', 'deleteItem', (params, callback) => {
      deleteItem(params);
      callback(null, null);
    });
    await handlePlotConfigRequest(workRequest, socket);
    expect(deleteItem).toMatchSnapshot();
  });
  it('update operation, update data in database', async () => {
    const workRequest = {
      uuid: '1',
      operation: 'update',
      plotName: 'plot1',
      experimentId: '1',
      body: { foo: 'bar', baz: [1, 2, 3] },
    };

    const updateItem = jest.fn();
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('DynamoDB', 'updateItem', (params, callback) => {
      updateItem(params);
      callback(null, null);
    });
    await handlePlotConfigRequest(workRequest, socket);
    expect(updateItem).toMatchSnapshot();
  });
  it('read operation, read data from database', async () => {
    const workRequest = {
      uuid: '1',
      operation: 'read',
      plotName: 'plot1',
      experimentId: '1',
    };

    const getItem = jest.fn();
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('DynamoDB', 'getItem', (params, callback) => {
      getItem(params);
      callback(null, null);
    });
    await handlePlotConfigRequest(workRequest, socket);
    expect(getItem).toMatchSnapshot();
  });
});
