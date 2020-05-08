const AWS = require('aws-sdk');
const config = require('../../config');


class ExperimentService {
  constructor() {
    this.tableName = `experiments-${config.clusterEnv}`;
    this.mockData = AWS.DynamoDB.Converter.marshall({
      experimentId: '5e959f9c9f4b120771249001',
      experimentName: 'TGFB1 experiment',
      matrixPath: 'biomage-results/tgfb1-3-BMP9.h5ad',
      cellSets: [
        {
          key: 1,
          name: 'Cell types',
          rootNode: true,
          children: [
            { key: 7, name: 'Hepatocytes', color: '#008DA6' },
            { key: 3, name: 'B cells', color: '#AB149E' },
            { key: 4, name: 'Kupffer cells', color: '#F44E3B' },
            {
              key: 5,
              name: 'Stellate cells and myofibroblasts',
              color: '#FCDC00',
            },
            {
              key: 6,
              name: 'Liver sinusoidal endothelial cells',
              color: '#68BC00',
            },
          ],
        },
        {
          key: 2,
          name: 'Louvain clusters',
          rootNode: true,
          children: [
            { key: 8, name: 'Cluster 1', color: '#CCCCCC' },
            { key: 9, name: 'Cluster 2', color: '#9F0500' },
            { key: 10, name: 'Cluster 3', color: '#C45100' },
          ],
        },
        { key: 15, name: 'My Custom Set', rootNode: true },
        {
          key: 11,
          name: 'k-Means clusters',
          rootNode: true,
          children: [
            { key: 12, name: 'Cluster 1', color: '#CCCCCC' },
            { key: 13, name: 'Cluster 2', color: '#9F0500' },
            { key: 14, name: 'Cluster 3', color: '#C45100' },
          ],
        },
      ],
    });
  }

  async getExperimentData(experimentId) {
    const dynamodb = new AWS.DynamoDB({
      region: 'eu-west-2',
    });
    let key = { experimentId };
    key = AWS.DynamoDB.Converter.marshall(key);

    const params = {
      TableName: this.tableName,
      Key: key,
      ProjectionExpression: 'experimentId, experimentName',
    };

    const data = await dynamodb.getItem(params).promise();
    const prettyData = AWS.DynamoDB.Converter.unmarshall(data.Item);
    return prettyData;
  }

  async getCellSets(experimentId) {
    const dynamodb = new AWS.DynamoDB({
      region: 'eu-west-2',
    });
    let key = { experimentId };
    key = AWS.DynamoDB.Converter.marshall(key);

    const params = {
      TableName: this.tableName,
      Key: key,
      ProjectionExpression: 'cellSets',
    };

    const data = await dynamodb.getItem(params).promise();
    const prettyData = AWS.DynamoDB.Converter.unmarshall(data.Item);

    return prettyData;
  }

  generateMockData() {
    const dynamodb = new AWS.DynamoDB({
      region: 'eu-west-2',
    });

    const params = {
      TableName: this.tableName,
      Item: this.mockData,
    };
    return dynamodb.putItem(params).promise();
  }
}

module.exports = ExperimentService;
