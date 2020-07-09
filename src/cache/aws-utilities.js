const AWS = require('aws-sdk');

const meta = new AWS.MetadataService({ httpOptions: { timeout: 1000 } });

const getMetaData = (path) => new Promise((resolve, reject) => {
  if (process.env.NODE_ENV === 'development') {
    reject(new Error('Local environment, no AZ available'));
    return;
  }
  const metaDataEndpoint = `/latest/meta-data/${path}`;
  meta.request(metaDataEndpoint, (err, availabilityZone) => {
    if (err) {
      reject(err);
    } else {
      resolve(availabilityZone);
    }
  });
});

module.exports = getMetaData;
