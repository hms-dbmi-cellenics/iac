const AWS = require('aws-sdk');
const _ = require('lodash');

const bucketName = 'cell-sets-staging';

const getCellSets = async (experimentId) => {
    const s3 = new AWS.S3();

    const outputObject = await s3.getObject(
    {
        Bucket: bucketName,
        Key: experimentId,
    },
    ).promise();

    const data = JSON.parse(outputObject.Body.toString());

    return data;
}

const migrateCellSets = async (experimentId) => {
  console.log(`Migrating experiment: ${experimentId}`);
    try {
      const cellSetsObject = await getCellSets(experimentId);
  
      const { cellSets: cellSetsList } = cellSetsObject;
  
      const scratchpadIndex = _.findIndex(cellSetsList, { key: 'scratchpad' });

      console.log('scratchpadIndexDebug');
      console.log(scratchpadIndex);

      if (scratchpadIndex !== -1) {
        cellSetsList[scratchpadIndex].name = 'Custom cell sets';
      } else {
        console.log(`experiment: ${experimentId} doesnt have a scratchpad!!!!`);
      }
  
      await updateCellSets(experimentId, cellSetsList);
      console.log(`Migration for experiment ${experimentId} finished, everything is ok, relax`);
    } catch (e) {
      console.error(`Error migrating experiment: ${experimentId}, ${e.message}`);
    }
}

const updateCellSets = async (experimentId, cellSetList) => {
  const cellSetsObject = JSON.stringify({ cellSets: cellSetList });

  const s3 = new AWS.S3();

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
  const s3 = new AWS.S3();
  
  var params = { Bucket: bucketName };  

  const result = await s3.listObjectsV2(params).promise();

  const keys = result.Contents.map((entry) => entry.Key);

  return keys;
}

getAllKeys().then((allKeys) => {
  allKeys.forEach(migrateCellSets);
});