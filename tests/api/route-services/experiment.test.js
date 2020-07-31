const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const ExperimentService = require('../../../src/api/route-services/experiment');

jest.mock('../../../src/config');
jest.mock('../../../src/utils/logging');

describe('tests for the experiment service', () => {
  it('Get experiment data works', async (done) => {
    const unmarshalledData = {
      Item: {
        experimentId: { S: '12345' },
        experimentName: { S: 'TGFB1 experiment' },
      },
    };

    const marshalledData = {
      experimentId: '12345',
      experimentName: 'TGFB1 experiment',
    };

    const e = new ExperimentService();

    const getItemSpy = jest.fn((x) => x);
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('DynamoDB', 'getItem', (params, callback) => {
      getItemSpy(params);
      callback(null, unmarshalledData);
    });

    e.getExperimentData('12345')
      .then((data) => {
        expect(data).toEqual(marshalledData);
        expect(getItemSpy).toHaveBeenCalledWith({
          TableName: 'experiments-test',
          Key: { experimentId: { S: '12345' } },
          ProjectionExpression: 'experimentId, experimentName',
        });
      })
      .then(() => done());
  });

  it('Get cell sets works', async (done) => {
    const e = new ExperimentService();

    const unmarshalledData = {
      Item: {
        cellSets: {
          L: [
            { M: { key: { N: 1 }, name: { S: 'set 1' }, color: { S: '#008DA6' } } },
            { M: { key: { N: 2 }, name: { S: 'set 2' }, color: { S: '#008D56' } } },
            { M: { key: { N: 3 }, name: { S: 'set 3' }, rootNode: { BOOL: true } } },
          ],
        },
      },
    };

    const marshalledData = {
      cellSets: [
        { key: 1, name: 'set 1', color: '#008DA6' },
        { key: 2, name: 'set 2', color: '#008D56' },
        { key: 3, name: 'set 3', rootNode: true },
      ],
    };

    AWSMock.setSDKInstance(AWS);
    const getItemSpy = jest.fn((x) => x);
    AWSMock.mock('DynamoDB', 'getItem', (params, callback) => {
      getItemSpy(params);
      callback(null, unmarshalledData);
    });

    e.getCellSets('12345')
      .then((data) => {
        expect(data).toEqual(marshalledData);
        expect(getItemSpy).toHaveBeenCalledWith(
          {
            TableName: 'experiments-test',
            Key: { experimentId: { S: '12345' } },
            ProjectionExpression: 'cellSets',
          },
        );
      })
      .then(() => done());
  });

  it('Update experiment cell sets works', async (done) => {
    const e = new ExperimentService();

    const testData = [
      {
        name: 'Empty cluster',
        key: 'empty',
        color: '#ff00ff',
        children: [],
        cellIds: [],
      },
    ];

    AWSMock.setSDKInstance(AWS);
    const putItemSpy = jest.fn((x) => x);
    AWSMock.mock('DynamoDB', 'updateItem', (params, callback) => {
      putItemSpy(params);
      callback(null, []); // We do not care about the return value here, it is not used.
    });

    const marshalledTestData = AWS.DynamoDB.Converter.marshall({ ':x': testData });

    e.updateCellSets('12345', testData)
      .then((returnValue) => {
        expect(returnValue).toEqual(testData);
        expect(putItemSpy).toHaveBeenCalledWith(
          {
            TableName: 'experiments-test',
            Key: { experimentId: { S: '12345' } },
            UpdateExpression: 'set cellSets = :x',
            ExpressionAttributeValues: marshalledTestData,
          },
        );
      })
      .then(() => done());
  });

  it('Generate mock data works', async (done) => {
    const e = new ExperimentService();

    AWSMock.setSDKInstance(AWS);
    const putItemSpy = jest.fn((x) => x);
    AWSMock.mock('DynamoDB', 'putItem', (params, callback) => {
      putItemSpy(params);
      callback(null, { hello: 'world' });
    });

    e.generateMockData()
      .then((a) => {
        expect(a).toEqual(AWS.DynamoDB.Converter.unmarshall(e.mockData));
        expect(putItemSpy).toHaveBeenCalledWith(
          {
            TableName: 'experiments-test',
            Item: e.mockData,
          },
        );
      })
      .then(() => done());
  });

  afterEach(() => {
    AWSMock.restore('DynamoDB');
  });
});
