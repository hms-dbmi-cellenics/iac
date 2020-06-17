const AWS = require('aws-sdk');
const config = require('../../config');
const mockData = require('./mock-data.json');

class ExperimentService {
  constructor() {
    this.tableName = `experiments-${config.clusterEnv}`;
    this.mockData = AWS.DynamoDB.Converter.marshall(mockData);
  }

  async getExperimentData(experimentId) {
    const dynamodb = new AWS.DynamoDB({
      region: config.awsRegion,
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
      region: config.awsRegion,
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

  async updateCellSets(experimentId, cellSetData) {
    const dynamodb = new AWS.DynamoDB({
      region: config.awsRegion,
    });
    let key = { experimentId };

    key = AWS.DynamoDB.Converter.marshall(key);

    const data = AWS.DynamoDB.Converter.marshall({ ':x': cellSetData });

    console.log(data);

    const params = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'set cellSets = :x',
      ExpressionAttributeValues: data,
    };

    await dynamodb.updateItem(params).promise();

    return cellSetData;
  }

  generateMockData() {
    const dynamodb = new AWS.DynamoDB({
      region: config.awsRegion,
    });

    const params = {
      TableName: this.tableName,
      Item: this.mockData,
    };
    return dynamodb.putItem(params).promise();
  }
}

module.exports = ExperimentService;
