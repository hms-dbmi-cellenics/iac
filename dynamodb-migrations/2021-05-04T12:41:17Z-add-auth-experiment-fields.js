const Dyno = require('dyno');

let updated = 0;

module.exports = (record, dyno, callback) => {  

  if (!process.env.K8S_ENV) {
    throw new Error('Environment (staging/production) must be specified.');
  }

  if (record.rbac_can_write) {
      console.log(`${record.experimentId} skipped as \`rbac_can_write\` attribute already exists.`)
      return callback();
  }

  if (record.project_id) {
    console.log(`${record.experimentId} skipped as \`project_id\` attribute already exists.`)
    return callback();
  }

  console.log(`${record.experimentId} flagged for updates`);

  const attrValues = {
    ':pid': record.experimentId,
  };

  if(process.env.K8S_ENV === 'production') {
    attrValues[':cw'] = Dyno.createSet(['a07c6615-d982-413b-9fdc-48bd85182e83']);
  } else if(process.env.K8S_ENV === 'staging') {
    attrValues[':cw'] = Dyno.createSet(['70c213d4-e7b6-4920-aefb-706ce8606ee2']);
  }

  // If you are running a dry-run, `dyno` will be null
  if (!dyno) return callback();

  dyno.updateItem({
    Key: {experimentId: record.experimentId},
    UpdateExpression: 'SET rbac_can_write = :cw, projectId = :pid',
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