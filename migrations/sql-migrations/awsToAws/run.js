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

  console.log(`Migrating User:`)
  console.log(JSON.stringify(user));

  // get all experiment_id's for user
  const sourceUserAccessEntries = await sourceSqlClient('user_access')
  .where('user_id', sourceUserId);
  
  // change user_id to target
  const targetUserAccessEntries = sourceUserAccessEntries.map(entry => ({...entry, user_id: targetUserId}))

  // migrate each experiment 
  // needs to happen before user_access
  for (var i = 0; i < targetUserAccessEntries.length; i++) {
    await migrateExperiment(targetUserAccessEntries[i], sourceSqlClient, targetSqlClient);
  }
  
  // insert entries into user_acess table on target
  sqlInsert(targetSqlClient, targetUserAccessEntries, 'user_access')

};

const migrateExperiment = async (userAccessEntry, sourceSqlClient, targetSqlClient) => {

  // get entries from experiment table
  const { experiment_id: experimentId } = userAccessEntry;

  const sourceExperimentTableEntries = await sourceSqlClient('experiment')
    .where('id', experimentId);

  // stringify necessary values
  const targetExperimentTableEntries = sourceExperimentTableEntries.map(entry => {
    return {
      ...entry,
      processing_config: JSON.stringify(entry.processing_config),
      samples_order: JSON.stringify(entry.processing_config)
    }
  })

  // insert
  await sqlInsert(targetSqlClient, targetExperimentTableEntries, 'experiment');

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
