const AWS = require('aws-sdk');
const _ = require('lodash');

const environment = 'development';
const bucketName = `cell-sets-${environment}`;

const projectsTableName = `projects-${environment}`
const experimentsTableName = `experiments-${environment}`
const samplesTableName = `samples-${environment}`

const createDynamoDbInstance = () => new AWS.DynamoDB({ 
  region: 'eu-west-1', 
  endpoint: 'http://localhost:4566',
  forcePathStyle: true });
const convertToDynamoDbRecord = (data) => AWS.DynamoDB.Converter.marshall(data, { convertEmptyValues: false });
const convertToJsObject = (data) => AWS.DynamoDB.Converter.unmarshall(data);

const getCellSets = async (experimentId) => {
    const s3 = new AWS.S3({endpoint: 'http://localhost:4566', forcePathStyle: true });

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

      const { projects: { metadataKeys } } = await getExperimentAttributes({ projectUuid },
        ['projects'],
        projectsTableName)
        
        
      const { samples } = await getExperimentAttributes({experimentId},
        ['samples'],
        samplesTableName)

      
        
        if (metadataKeys.length) {

          // original metadata (possibly incorrect)
          const samplesEntries = Object.entries(samples);

          const metadataOriginal = metadataKeys.reduce((acc, key) => {
            // Make sure the key does not contain '-' as it will cause failure in GEM2S
            const sanitizedKey = key.replace(/-+/g, '_');
    
            acc[sanitizedKey] = samplesEntries.map(
              ([, sample]) => sample.metadata[key] || defaultMetadataValue,
            );
            return acc;
          }, {});

    
          // get metadata in same order as sampleIds
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

          metadataKeys.forEach(metadataKey => {
            const origOrder = metadataOriginal[metadataKey];
            const correctOrder = metadata[metadataKey];
            if (!_.isEqual(origOrder, correctOrder)) {
              console.log(`Experiment: ${experimentId}, Metadata: ${metadataKey} is wrong!!!`)

              console.log('origOrder')
              console.log(origOrder)
              console.log('correctOrder')
              console.log(correctOrder)
            }
          })
          console.log('metadataDebug')
          console.log(metadata)
          console.log(metadataOriginal)


          // get cellSets
          const { cellSets } = await getCellSets(experimentId);

          // get samples cell set
          const samplesSet = cellSets.filter(cellSet => cellSet.key === 'sample')[0];
          

          // for each metadata track create the cellIds associated with it
          metadataKeys.forEach(metadataKey => {

            // get the corresponding set
            metadataSet = cellSets.filter(cellSet => cellSet.key === metadataKey)[0];

            // add cell ids for each metadata set
            metadataValuesOrdered = metadata[metadataKey];

            const uniqueMetadataValues = metadataValuesOrdered.filter((v, i, a) => a.indexOf(v) === i);

            uniqueMetadataValues.forEach(metadataValue => {

              // get new cell ids
              const newCellIds = [];

              sampleIds.forEach((sampleId, index) => {
                if (metadataValuesOrdered[index] === metadataValue) {

                  const sampleCellIds = samplesSet
                    .children
                    .filter(child => child.key === sampleId)[0]
                    .cellIds;

                  newCellIds.push(...sampleCellIds)
                }
              })

              // use to overwrite existing cell ids in metadata set
              metadataSetIndex = cellSets.filter(cellSet => cellSet.key === metadataKey)[0];


            })

          })

        }
    


      // const cellSetsObject = await getCellSets(experimentId);
  
      // const { cellSets: cellSetsList } = cellSetsObject;
  
      // const scratchpadIndex = _.findIndex(cellSetsList, { key: 'scratchpad' });

      // console.log('scratchpadIndexDebug');
      // console.log(scratchpadIndex);

      // if (scratchpadIndex !== -1) {
      //   cellSetsList[scratchpadIndex].name = 'Custom cell sets';
      // } else {
      //   console.log(`experiment: ${experimentId} doesnt have a scratchpad!!!!`);
      // }
  
      // // await updateCellSets(experimentId, cellSetsList);
      // console.log(`Migration for experiment ${experimentId} finished, everything is ok, relax`);
    } catch (e) {
      console.error(`Error migrating experiment: ${experimentId}, ${e.message}`);
    }
}

const updateCellSets = async (experimentId, cellSetList) => {
  const cellSetsObject = JSON.stringify({ cellSets: cellSetList });

  const s3 = new AWS.S3({endpoint: 'http://localhost:4566', forcePathStyle: true});

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
  const s3 = new AWS.S3({
    endpoint: 'http://localhost:4566',
    forcePathStyle: true });
  
  var params = { Bucket: bucketName };  

  const result = await s3.listObjectsV2(params).promise();

  const keys = result.Contents.map((entry) => entry.Key);

  return keys;
}

getAllKeys().then((allKeys) => {
  allKeys.forEach(key => {
    const res = migrateCellSets(key);
    if (res === 'stop') throw BreakException;
  });
});