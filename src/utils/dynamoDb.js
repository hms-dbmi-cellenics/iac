const AWS = require('aws-sdk');
const config = require('../config');

const createDynamoDbInstance = () => new AWS.DynamoDB({
  region: config.awsRegion,
});

const convertToDynamoDbRecord = (data) => AWS.DynamoDB.Converter.marshall(data);
const convertToJsObject = (data) => AWS.DynamoDB.Converter.unmarshall(data);

module.exports = { createDynamoDbInstance, convertToDynamoDbRecord, convertToJsObject };
