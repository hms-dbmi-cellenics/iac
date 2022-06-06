const Dyno = require('dyno');
const _ = require('lodash');

let updated = 0;

// Camelcases absolute_threshold wherever it finds it
const recursiveCamelcase = (processingConfig) => (
  _.transform(processingConfig, (acc, value, key, target) => {
    let camelKey;

    if (key === 'absolute_threshold') {
      camelKey = 'absoluteThreshold';
    } else {
      camelKey = key;
    }

    if (_.isObject(value)) {
      acc[camelKey] = recursiveCamelcase(value);
    } else {
      let camelValue = value;
      if(camelValue === 'absolute_threshold'){
        camelValue = 'absoluteThreshold';
      }
  
      acc[camelKey] = camelValue;
    }
  })
);

module.exports = (record, dyno, callback) => {
  if (!process.env.K8S_ENV) {
    throw new Error('Environment (staging/production) must be specified.');
  }

  try {
    const attrValues = {
      ':p_config': recursiveCamelcase(record.processingConfig)
    };

    // If you are running a dry-run, `dyno` will be null
    if (!dyno) return callback();

    dyno.updateItem({
      Key: {experimentId: record.experimentId},
      UpdateExpression: 'SET processingConfig = :p_config',
      ExpressionAttributeValues: attrValues
    }, (err) => {
      if(err) {
        console.log(`${record.experimentId} failed to update`);
        throw new Error(err);
      }
    });

    console.log(`Updated experiment ${record.experimentId}`)

    updated++;
    callback();
  } catch(e) {
    console.log('eDebug');
    console.log(e);
  }
}

module.exports.finish = (dyno, callback) => {
  console.log(`Updated ${updated} records.`);
  callback();
}