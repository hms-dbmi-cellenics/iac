const config = require('../../config');
const { createDynamoDbInstance, convertToJsObject, convertToDynamoDbRecord } = require('../../utils/dynamoDb');


class PlotsTablesService {
  constructor() {
    this.tableName = `plots-tables-${config.clusterEnv}`;
  }

  async create(experimentId, plotUuid, data) {
    const plotConfig = convertToDynamoDbRecord({
      ...data,
      experimentId,
      plotUuid,
    });

    const params = {
      TableName: this.tableName,
      Item: plotConfig,
    };
    const dynamodb = createDynamoDbInstance();

    const response = await dynamodb.putItem(params).promise();
    const prettyResponse = convertToJsObject(response.Item);

    return prettyResponse;
  }

  async read(experimentId, plotUuid) {
    const key = convertToDynamoDbRecord({
      experimentId,
      plotUuid,
    });

    const params = {
      TableName: this.tableName,
      Key: key,
    };
    const dynamodb = createDynamoDbInstance();
    const response = await dynamodb.getItem(params).promise();
    const prettyResponse = convertToJsObject(response.Item);

    return prettyResponse;
  }

  async delete(experimentId, plotUuid) {
    const key = convertToDynamoDbRecord({
      experimentId,
      plotUuid,
    });

    const params = {
      TableName: this.tableName,
      Key: key,
    };

    const dynamodb = createDynamoDbInstance();
    await dynamodb.deleteItem(params).promise();
  }
}

module.exports = PlotsTablesService;
