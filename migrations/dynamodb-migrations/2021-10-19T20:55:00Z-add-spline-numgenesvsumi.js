const _ = require('lodash');
const Dyno = require('dyno');
const AWS = require('aws-sdk');

let updated = 0;

const renameGamToLinear = (settings) => {
  settings.regressionType = 'linear';
  settings.regressionTypeSettings.linear = _.cloneDeep(settings.regressionTypeSettings.gam);
  delete settings.regressionTypeSettings.gam;
}

module.exports = (record, dyno, callback) => { 
  if (!process.env.K8S_ENV) {
    throw new Error('Environment (staging/production) must be specified.');
  }

  const { 
    api_url: garbageapi_url = null, 
    auth_JWT: garbageAuthJWT = null,  
    auto: garbageAuto = null, 
    filterSettings: garbageFilterSettings = null, 
    enabled = null, 
    ...samplesFilterSettings 
  } = record.processingConfig.numGenesVsNumUmis;

  
  Object.keys(samplesFilterSettings).forEach((sampleId) => {
    const { filterSettings, defaultFilterSettings } = samplesFilterSettings[sampleId];
    
    // Don't run over experiments that already migrated
    if (filterSettings.regressionType !== 'linear') {
      renameGamToLinear(filterSettings);
      renameGamToLinear(defaultFilterSettings);
    }
    
    const calculatedPLevel = defaultFilterSettings.regressionTypeSettings.linear['p.level'];

    filterSettings.regressionTypeSettings.spline = { 'p.level': calculatedPLevel };
    defaultFilterSettings.regressionTypeSettings.spline = { 'p.level': calculatedPLevel };
  });

  const processingConfigToSet = _.cloneDeep(record.processingConfig);
  processingConfigToSet.numGenesVsNumUmis = { ...samplesFilterSettings };
  
  if (enabled) {
    processingConfigToSet.numGenesVsNumUmis.enabled = enabled;
  }

  if (garbageFilterSettings) {
    processingConfigToSet.numGenesVsNumUmis.filterSettings = garbageFilterSettings;
  }

  if (!dyno) {
    console.log('Dry-run detected, no updates were made');

    return callback();
  }

  dyno.updateItem({
    Key: {experimentId: record.experimentId},
    UpdateExpression: 'SET processingConfig = :processingConfig',
    ExpressionAttributeValues: {
      ':processingConfig': processingConfigToSet
    }
  }, (err) => {
    if(err) {
      console.log(`${record.experimentId} failed to update`);
      throw new Error(err);
    }
    
    console.log(`Experiment ${record.experimentId} migrated successfully`);
  });

  updated++;
  callback();
}

module.exports.finish = (dyno, callback) => {
  console.log(`Updated ${updated} records.`);
  callback();
}