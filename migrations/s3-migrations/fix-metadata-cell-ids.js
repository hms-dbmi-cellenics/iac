const AWS = require('aws-sdk');
const _ = require('lodash');

const environment = 'development';
const bucketName = `cell-sets-${environment}`;
const projectsTableName = `projects-${environment}`
const experimentsTableName = `experiments-${environment}`
const samplesTableName = `samples-${environment}`

let config;
if (environment == 'development') {
  config = { region: 'eu-west-1', endpoint: 'http://localhost:4566', forcePathStyle: true };
} else {
  config = { region: 'eu-west-1' }
}

const createDynamoDbInstance = () => new AWS.DynamoDB(config);
const convertToDynamoDbRecord = (data) => AWS.DynamoDB.Converter.marshall(data, { convertEmptyValues: false });
const convertToJsObject = (data) => AWS.DynamoDB.Converter.unmarshall(data);

const getCellSets = async (experimentId) => {
    const s3 = new AWS.S3(config);

    const outputObject = await s3.getObject(
    {
        Bucket: bucketName,
        Key: experimentId,
    },
    ).promise();

    const data = JSON.parse(outputObject.Body.toString());

    return data;
}

const getExperimentAttributes = async (keyObject, attributes, tableName) => {
  const dynamodb = createDynamoDbInstance();
  const key = convertToDynamoDbRecord(keyObject);

  const params = {
    TableName: tableName,
    Key: key,
  };

  if (Array.isArray(attributes) && attributes.length > 0) {
    params.ProjectionExpression = attributes.join();
  }

  const data = await dynamodb.getItem(params).promise();
  if (Object.keys(data).length === 0) {
    throw new NotFoundError('Experiment does not exist.');
  }

  const prettyData = convertToJsObject(data.Item);
  return prettyData;
};

const migrateCellSets = async (experimentId) => {
  console.log(`Migrating experiment: ${experimentId}`);
  try {
      const {sampleIds, projectId: projectUuid} = await getExperimentAttributes(
        { experimentId }, 
        ['sampleIds', 'projectId'],
        experimentsTableName);

      const { projects: { metadataKeys } } = await getExperimentAttributes(
        { projectUuid },
        ['projects'],
        projectsTableName)
        
        
      const { samples } = await getExperimentAttributes(
        { experimentId },
        ['samples'],
        samplesTableName)

      
        // short circuit if no metadata
        if(!metadataKeys.length) return;
        
        // original metadata (possibly incorrect order of column values)
        const samplesEntries = Object.entries(samples);

        const metadataOriginal = metadataKeys.reduce((acc, key) => {
          // Make sure the key does not contain '-' as it will cause failure in GEM2S
          const sanitizedKey = key.replace(/-+/g, '_');
  
          acc[sanitizedKey] = samplesEntries.map(
            ([, sample]) => sample.metadata[key] || defaultMetadataValue,
          );
          return acc;
        }, {});

  
        // get metadata in same order as sampleIds (correct order)
        const metadata = metadataKeys.reduce((acc, key) => {
          // Make sure the key does not contain '-' as it will cause failure in GEM2S
          const sanitizedKey = key.replace(/-+/g, '_');
  
          acc[sanitizedKey] = sampleIds.map((sampleId) => {
            const sample = samples[sampleId];
            return sample.metadata[key] || defaultMetadataValue;
          });
  
          return acc;
        }, {});

        // check if they differ
        // NOTE: may not identity ALL incorrect experiments (maybe fine if re-order after GEM2S?)
        // All get updated, incorrect order or not so doesn't really matter
        metadataKeys.forEach(metadataKey => {
          const origOrder = metadataOriginal[metadataKey];
          const correctOrder = metadata[metadataKey];
          if (!_.isEqual(origOrder, correctOrder)) {
            console.log(
              `\n----`,
              `\n🚨 Experiment: ${experimentId}`,
              `\n🚨 --> ${metadataKey} metadata column is wrong!!!`,
              '\ncorrect: ', correctOrder,
              '\noriginal:', origOrder,
              )
          }
        });

        // get cellSets (will update metadata column cellIds)
        const { cellSets } = await getCellSets(experimentId);

        // get samples cell set in order to extract cellIds for each sample
        const samplesSet = cellSets.filter(cellSet => cellSet.key === 'sample')[0];

        // iterate through each metadata column
        metadataKeys.forEach(metadataKey => {

          // metadata column values in order corresponding to sampleIds
          metadataValuesOrdered = metadata[metadataKey];

          // unique metadata column values
          const uniqueMetadataValues = metadataValuesOrdered.filter((v, i, a) => a.indexOf(v) === i);

          // get position of metadata column cell set
          const cellSetKeys = cellSets.map(cellSet => cellSet.key);
          const metadataSetIndex = cellSetKeys.indexOf(metadataKey);

          // iterate through each unique value
          uniqueMetadataValues.forEach(uniqueMetadataValue => {

            // create new cell ids
            const newCellIds = [];

            // add sample cell ids to new cell ids if the sample has current metadata column value
            sampleIds.forEach((sampleId, index) => {
              if (metadataValuesOrdered[index] === uniqueMetadataValue) {

                const sampleCellIds = samplesSet
                  .children
                  .filter(child => child.key === sampleId)[0]
                  .cellIds;

                newCellIds.push(...sampleCellIds)
              }
            });

  
            // get position of metadata column value child
          const metadataSetChildNames = cellSets[metadataSetIndex].children.map(child => child.name);
          const metadataNameIndex = metadataSetChildNames.indexOf(uniqueMetadataValue);

          // overwrite cellIds with new cellIds
          cellSets[metadataSetIndex].children[metadataNameIndex].cellIds = newCellIds;

          });
        })

      await updateCellSets(experimentId, cellSets);
      console.log(`Migration for experiment ${experimentId} finished, everything is ok, relax`);
    } catch (e) {
      console.error(`Error migrating experiment: ${experimentId}, ${e.message}`);
    }
}

const updateCellSets = async (experimentId, cellSetList) => {
  const cellSetsObject = JSON.stringify({ cellSets: cellSetList });

  const s3 = new AWS.S3(config);

  await s3.putObject(
    {
      Bucket: bucketName,
      Key: experimentId,
      Body: cellSetsObject,
    },
  ).promise();

  return cellSetList;
}

const getAllKeys = async () => {
  const s3 = new AWS.S3(config);
  
  var params = { Bucket: bucketName };  

  const result = await s3.listObjectsV2(params).promise();

  const keys = result.Contents.map((entry) => entry.Key);

  return keys;
}

getAllKeys().then((allKeys) => {
  allKeys.forEach(migrateCellSets);
});