const _ = require('lodash');
const knexfileLoader = require('../knexfile');
const knex = require('knex');
const parseArgs = require('minimist');

const DOWNLOAD_FOLDER = '../downloaded_data/aws_to_aws'

// set defaults arguments so that backup production
var opts = {
  default: {
    sandboxId: 'default',
    sourceRegion: 'eu-west-1',
    targetRegion: 'us-east-1',
    targetEnvironment: 'development',
    sourceLocalPort: 5432
  }
}
// 5431 for inframock
// 5433 for production target
opts.default.targetLocalPort = opts.default.targetEnvironment === 'development' ? 5431 : 5433;

// destructure command line args
var argv = parseArgs(process.argv.slice(2), opts);
var {
  sandboxId,
  sourceEnvironment,
  targetEnvironment,
  sourceRegion,
  targetRegion,
  sourceLocalPort,
  targetLocalPort,
  sourceCognitoUserPoolId,
  targetCognitoUserPoolId,
  sourceProfile,
  targetProfile
} = argv;


// TODO:
// this is for Biomage deployment
// adapt getConnectionParams.js so that can also get two deployments
const createSqlClient = async (activeEnvironment, sandboxId, region, localPort, profile) => {
  const knexfile = await knexfileLoader(activeEnvironment, sandboxId, region, localPort, profile);
  return knex.default(knexfile[activeEnvironment]);
};

const migrateUser = async (user, sourceSqlClient, targetSqlClient) => {
  const { sourceUserId, targetUserId, email } = user;

  console.log(`\n==========\nMigrating User: ${email}\n`,)

  // get all experiment_id's for user
  const sourceUserAccessEntries = await sourceSqlClient('user_access')
    .where('user_id', sourceUserId);

  // change user_id to target
  const targetUserAccessEntries = sourceUserAccessEntries.map(entry => ({ ...entry, user_id: targetUserId }))

  for (var i = 0; i < targetUserAccessEntries.length; i++) {
    const { experiment_id: experimentId } = targetUserAccessEntries[i];

    console.log(`Migrating experimentId: ${experimentId}`)

    // migrate experiment table
    await migrateExperiment(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): experiment [✓]')

    // migrate experiment_execution table
    await migrateExperimentExecution(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): experiment_execution [✓]')

    // migrate sample, sample_file, and sample_to_sample_file_map tables
    await migrateSamples(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): sample, sample_file, sample_to_sample_file_map [✓]')
    
    // migrate metadata_track and sample_in_metadata_track_map tables
    await migrateMetadata(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): metadata_track, sample_in_metadata_track_map [✓]')

    // migrate plot table
    await migratePlots(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): plot [✓]')
  }

  // insert entries into user_acess table on target
  // experiment table entries (migrateExperiment above) need to be present before user_access
  // TODO: also insert admin role
  sqlInsert(targetSqlClient, targetUserAccessEntries, 'user_access')

  console.log(`Finished Migrating User: ${email} \n==========\n`)


};

const migratePlots = async (experimentId, sourceSqlClient, targetSqlClient) => {

  // migrate plot table
  // ----
  // get source entries
  const sourcePlotEntries = await sourceSqlClient('plot')
    .where('experiment_id', experimentId);

  // insert into target
  await sqlInsert(targetSqlClient, sourcePlotEntries, 'plot');

};

const migrateSamples = async (experimentId, sourceSqlClient, targetSqlClient) => {

  // migrate sample table
  // ----
  // get source entries
  const sourceSampleEntries = await sourceSqlClient('sample')
    .where('experiment_id', experimentId);

  // insert into target
  await sqlInsert(targetSqlClient, sourceSampleEntries, 'sample');

  // migrate sample_to_sample_file_map table
  // ----
  const sourceSampleIds = sourceSampleEntries.map(entry => entry.id);

  const sourceSampleToSamplesFileMapEntries = await sourceSqlClient('sample_to_sample_file_map')
    .whereIn('sample_id', sourceSampleIds);

  // migrate sample_file table
  // ----
  const sourceSampleFileIds = sourceSampleToSamplesFileMapEntries.map(entry => entry.sample_file_id)

  const sourceSampleFileEntries = await sourceSqlClient('sample_file')
    .whereIn('id', sourceSampleFileIds);

    await sqlInsert(targetSqlClient, sourceSampleFileEntries, 'sample_file');
  
  // insert into sample_to_sample_file_map has to happen AFTER sample_file entry insertion
  await sqlInsert(targetSqlClient, sourceSampleToSamplesFileMapEntries, 'sample_to_sample_file_map');

};

const migrateExperiment = async (experimentId, sourceSqlClient, targetSqlClient) => {

  const sourceExperimentTableEntries = await sourceSqlClient('experiment')
    .where('id', experimentId);

  // stringify necessary values
  const targetExperimentTableEntries = sourceExperimentTableEntries.map(entry => {
    return {
      ...entry,
      processing_config: JSON.stringify(entry.processing_config),
      samples_order: JSON.stringify(entry.samples_order)
    }
  })

  // delete it if there
  await sqlDelete(targetSqlClient, 'id', experimentId, 'experiment');

  // insert
  await sqlInsert(targetSqlClient, targetExperimentTableEntries, 'experiment');

};

const migrateExperimentExecution = async (experimentId, sourceSqlClient, targetSqlClient) => {

  const sourceExperimentExecutionTableEntries = await sourceSqlClient('experiment_execution')
    .where('experiment_id', experimentId);

  // stringify necessary values
  const targetExperimentExecutionTableEntries = sourceExperimentExecutionTableEntries.map(entry => {
    return {
      ...entry,
      last_status_response: JSON.stringify(entry.last_status_response)
    }
  })

  // insert
  await sqlInsert(targetSqlClient, targetExperimentExecutionTableEntries, 'experiment_execution');
};

const migrateMetadata = async (experimentId, sourceSqlClient, targetSqlClient) => {

  // migrate metadata_track table
  // ----
  // get source entries
  const sourceMetadataTrackEntries = await sourceSqlClient('metadata_track')
    .where('experiment_id', experimentId);

  if (!sourceMetadataTrackEntries.length) return;

  // insert into target
  await sqlInsert(targetSqlClient, sourceMetadataTrackEntries, 'metadata_track');

  // migrate sample_in_metadata_track_map table
  // ----
  const sourceMetadataTrackIds = sourceMetadataTrackEntries.map(entry => entry.id);

  for (var i = 0; i < sourceMetadataTrackIds.length; i++) {

    const metadataTrackId = sourceMetadataTrackIds[i];

    const sourceSampleInMetadataTrackMapEntries = await sourceSqlClient('sample_in_metadata_track_map')
      .where('metadata_track_id', metadataTrackId);

    // insert into target
    await sqlInsert(targetSqlClient, sourceSampleInMetadataTrackMapEntries, 'sample_in_metadata_track_map');
  };
};

const getUsersToMigrate = (sourceCognitoUsers, targetCognitoUsers, createdUserEmails) => {

  // only migrate source users that have email in createdUserEmails
  const usersToMigrate = sourceCognitoUsers
    .filter(user => {
      const emailAttribute = user.Attributes.filter(attr => attr.Name == "email");
      return createdUserEmails.includes(emailAttribute[0].Value);
    })
    // only keep attributes: has all needed values and is flat
    .map(user => {
      const flatAttributes = {};
      user.Attributes.forEach(attr => flatAttributes[attr.Name] = attr.Value);
      return flatAttributes;
    });

  // get map from user_id to email for targetCognitoUsers
  const targetCognitoUsersMap = {};

  targetCognitoUsers
    .forEach(user => {
      const flatAttributes = {};
      user.Attributes.forEach(attr => flatAttributes[attr.Name] = attr.Value);
      targetCognitoUsersMap[flatAttributes.email] = user.Username;
    });

  // add targetUserId to usersToMigrate
  // also change "sub" to sourceUserId
  usersToMigrate.forEach((user, index) => {
    usersToMigrate[index]['targetUserId'] = targetCognitoUsersMap[user.email];
    usersToMigrate[index]['sourceUserId'] = usersToMigrate[index]['sub'];
    delete usersToMigrate[index]['sub'];
  });

  return usersToMigrate;
};

const sqlInsert = async (sqlClient, sqlObject, tableName, extraLoggingData = {}) => {
  try {
    return await sqlClient(tableName).insert(sqlObject).returning('*');
  } catch (e) {
    throw new Error(
      `
      ----------------------
      -------------------
      Error inserting this object in ${tableName}:
      sqlObject: ${JSON.stringify(sqlObject)}
      -------------------
      Original Error: ${e}
      -------------------
      ----------------------
      extraLoggingData: ${JSON.stringify(extraLoggingData)}
      `
    );
  }
}

const sqlDelete = async (sqlClient, queryColumn, queryValue, tableName, extraLoggingData = {}) => {
  try {
    return await sqlClient(tableName).del().where(queryColumn, queryValue);
  } catch (e) {
    throw new Error(
      `
      ----------------------
      -------------------
      Error deleting from ${tableName}:
      queryColumn: ${queryColumn}
      queryValue: ${queryValue}
      -------------------
      Original Error: ${e}
      -------------------
      ----------------------
      extraLoggingData: ${JSON.stringify(extraLoggingData)}
      `
    );
  }
}

const run = async (usersToMigrate, sandboxId, sourceEnvironment, targetEnvironment, sourceRegion, targetRegion, sourceLocalPort, targetLocalPort, sourceProfile, targetProfile) => {
  // where users will be migrated from
  const sourceSqlClient = await createSqlClient(sourceEnvironment, sandboxId, sourceRegion, sourceLocalPort, sourceProfile);

  // where users will be migrated to
  const targetSqlClient = await createSqlClient(targetEnvironment, sandboxId, targetRegion, targetLocalPort, targetProfile);

  // migrate each user
  for (var i = 0; i < usersToMigrate.length; i++) {
    await migrateUser(usersToMigrate[i], sourceSqlClient, targetSqlClient);
  };

};

if (!sourceCognitoUserPoolId) {
  console.log('You need to specify the sourceCognitoUserPoolId.');
  console.log('e.g.: npm run awsToAws -- --sourceCognitoUserPoolId=eu-west-1_abcd1234');

} else if (!sourceCognitoUserPoolId) {
  console.log('You need to specify the targetCognitoUserPoolId.');
  console.log('e.g.: npm run awsToAws -- --targetCognitoUserPoolId=us-east-1_abcd1234');

} else if (!sourceEnvironment) {
  console.log('You need to specify what source environment to migrate from.');
  console.log('e.g.: npm run awsToAws -- --sourceEnvironment=staging');

} else if (!sourceProfile) {
  console.log('You need to specify the aws profile to use for the source account.');
  console.log('e.g.: npm run awsToAws -- --sourceProfile=default');

} else if (!targetProfile) {
  console.log('You need to specify the aws profile to use for the target account.');
  console.log('e.g.: npm run awsToAws -- --targetProfile=hms');

} else {
  // ----------------------Dynamo dumps----------------------
  const sourceCognitoUsers = require(`${DOWNLOAD_FOLDER}/${sourceCognitoUserPoolId}.json`);
  const targetCognitoUsers = require(`${DOWNLOAD_FOLDER}/${targetCognitoUserPoolId}.json`);
  const createdUserEmails = require(`${DOWNLOAD_FOLDER}/test_user.json`).map(user => user.email);
  // ----------------------Dynamo dumps----------------------

  const usersToMigrate = getUsersToMigrate(sourceCognitoUsers, targetCognitoUsers, createdUserEmails)

  run(usersToMigrate, sandboxId, sourceEnvironment, targetEnvironment, sourceRegion, targetRegion, sourceLocalPort, targetLocalPort, sourceProfile, targetProfile)
    .then(() => {
      console.log('>>>>--------------------------------------------------------->>>>');
      console.log('                     finished');
      console.log('>>>>--------------------------------------------------------->>>>');
    }).catch((e) => console.log(e));



}
