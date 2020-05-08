/* eslint-env jest */
const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const ExperimentService = require('../../../src/api/route-services/experiment');

describe('tests for the experiment service', () => {
  // eslint-disable-next-line arrow-parens
  it('Get experiment data works', async done => {
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
          TableName: 'experiments-staging',
          Key: { experimentId: { S: '12345' } },
          ProjectionExpression: 'experimentId, experimentName',
        });
      })
      .then(() => done());
  });

  // eslint-disable-next-line arrow-parens
  it('Get cell sets works', async done => {
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
            TableName: 'experiments-staging',
            Key: { experimentId: { S: '12345' } },
            ProjectionExpression: 'cellSets',
          },
        );
      })
      .then(() => done());
  });

  // eslint-disable-next-line arrow-parens
  it('Generate mock data works', async done => {
    const e = new ExperimentService();

    AWSMock.setSDKInstance(AWS);
    const putItemSpy = jest.fn((x) => x);
    AWSMock.mock('DynamoDB', 'putItem', (params, callback) => {
      putItemSpy(params);
      callback(null, { hello: 'world' });
    });

    e.generateMockData()
      .then((a) => {
        expect(a).toEqual({ hello: 'world' });
        expect(putItemSpy).toHaveBeenCalledWith(
          {
            TableName: 'experiments-staging',
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
