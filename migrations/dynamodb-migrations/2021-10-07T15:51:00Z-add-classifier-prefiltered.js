const Dyno = require('dyno');

let updated = 0;

module.exports = (record, dyno, callback) => {  

  if (!process.env.K8S_ENV) {
    throw new Error('Environment (staging/production) must be specified.');
  }

  if(!record.processingConfig?.classifier) {
    console.log(`${record.experimentId} skipped as it does not contain classifier in processingConfig`)
    return callback();
  }


  if(!Object.prototype.hasOwnProperty.call(record.processingConfig?.classifier, 'enabled')) {
    console.log(`${record.experimentId} skipped as it does not contain the right processingConfig schema`)
    return callback();
  }

  const enabled = record.processingConfig.classifier.enabled

  console.log(`${record.experimentId} flagged for updates with prefiltered value ${!enabled}`);

  const attrValues = {
    ':prefiltered': !enabled,
  };

  // If you are running a dry-run, `dyno` will be null
  if (!dyno) return callback();

  dyno.updateItem({
    Key: {experimentId: record.experimentId},
    UpdateExpression: 'SET processingConfig.classifier.prefiltered = :prefiltered',
    ExpressionAttributeValues: attrValues
  }, (err) => {
    if(err) {
      console.log(`${record.experimentId} failed to update`);
      throw new Error(err);
    }
  });

  updated++;
  callback();
}

module.exports.finish = (dyno, callback) => {
  console.log(`Updated ${updated} records.`);
  callback();
}