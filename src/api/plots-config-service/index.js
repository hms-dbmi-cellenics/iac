const validateRequest = require('../../utils/schema-validator');
const { createDynamoDbInstance, convertToJsObject, convertToDynamoDbRecord } = require('../../utils/dynamoDb');
const logger = require('../../utils/logging');

const tableName = 'plots-configs';

const readPlotsConfig = async (experimentId, plotName) => {
  const key = convertToDynamoDbRecord({ id: `${experimentId}-${plotName}` });

  const params = {
    TableName: tableName,
    Key: key,
  };
  const dynamodb = createDynamoDbInstance();
  const data = await dynamodb.getItem(params).promise();
  const prettyData = convertToJsObject(data.Item);
  return prettyData.data;
};

const updatePlotsConfig = async (experimentId, plotName, data) => {
  const key = convertToDynamoDbRecord({ id: `${experimentId}-${plotName}` });
  const dbData = convertToDynamoDbRecord({ ':x': data });

  const params = {
    TableName: tableName,
    Key: key,
    ExpressionAttributeNames: {
      '#d': 'data',
    },
    UpdateExpression: 'set #d = :x',
    ExpressionAttributeValues: dbData,
  };
  const dynamodb = createDynamoDbInstance();
  await dynamodb.updateItem(params).promise();
};

const createPlotsConfig = async (experimentId, plotName, data) => {
  const config = convertToDynamoDbRecord({
    id: `${experimentId}-${plotName}`,
    data,
  });
  const params = {
    TableName: tableName,
    Item: config,
  };
  const dynamodb = createDynamoDbInstance();
  await dynamodb.putItem(params).promise();
};

const deletePlotsConfig = async (experimentId, plotName) => {
  const key = convertToDynamoDbRecord(`${experimentId}-${plotName}`);
  const params = {
    TableName: tableName,
    Key: key.record,
  };
  const dynamodb = createDynamoDbInstance();
  await dynamodb.deleteItem(params).promise();
};

const handlePlotConfigRequest = async (plotConfigRequest, socket) => {
  validateRequest(plotConfigRequest, 'PlotConfigRequest');
  const {
    uuid, operation, plotName, experimentId, body,
  } = plotConfigRequest;

  const response = { payload: {} };
  try {
    switch (operation) {
      case 'create':
        await createPlotsConfig(experimentId, plotName, body);
        break;
      case 'read': {
        response.payload = await readPlotsConfig(experimentId, plotName);
        break;
      }
      case 'update': {
        await updatePlotsConfig(experimentId, plotName, body);
        break;
      }
      case 'delete': {
        await deletePlotsConfig(experimentId, plotName, body);
        break;
      }
      default:
        break;
    }
    response.result = 'success';
  } catch (error) {
    logger.error(`Failed to do '${operation}' operation`);
    logger.trace(error);
    response.result = 'error';
  }
  response.operation = operation;
  socket.emit(`PlotConfigResponse-${uuid}`, response);
  logger.log(`Response sent back to ${uuid}`);
};

module.exports = handlePlotConfigRequest;
