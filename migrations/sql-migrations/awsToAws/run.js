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
    sourceLocalPort: 5432,
    targetLocalPort: 5433
  }
}

// destructure command line args
var argv = parseArgs(process.argv.slice(2), opts);
var {
  environment,
  sandboxId,
  sourceRegion,
  targetRegion,
  sourceLocalPort,
  targetLocalPort,
  sourceCognitoUserPoolId,
  targetCognitoUserPoolId
} = argv;


// TODO:
// this is for Biomage deployment
// adapt getConnectionParams.js so that can also get two deployments
const createSqlClient = async (activeEnvironment, sandboxId, region, localPort) => {
  const knexfile = await knexfileLoader(activeEnvironment, sandboxId, region, localPort);
  return knex.default(knexfile[activeEnvironment]);
};

const migrateUser = async (user, sourceSqlClient, targetSqlClient) => {
  const { sub: userId, email } = user;

  console.log(`Migrating User:`)
  console.log(JSON.stringify(user));

  // get all experiment_id's for user
  const userAccessEntries = await sourceSqlClient('user_access')
    .where('user_id', userId);

  // ----
  // TODO: update user_id to be for destination deployment
  // TODO: insert entries into user_acess table
  // ----

  // console.log('userAccessEntries:')
  // console.log(userAccessEntries)

  // migrate each experiment
  for (var i = 0; i < userAccessEntries.length; i++) {
    await migrateExperiment(userAccessEntries[i], sqlClient, sourceSqlClient, targetSqlClient);
  }
};

const migrateExperiment = async (experiment, sourceSqlClient, targetSqlClient) => {

  // get entries from experiment table
  const { experiment_id: experimentId } = experiment;

  console.log(`Migrating experiment:`)
  console.log(JSON.stringify(experiment));

  const experimentTableEntries = await sourceSqlClient('experiment')
    .where('id', experimentId);


  console.log('experimentTableEntries:')
  console.log(experimentTableEntries)

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

  // add target user_id to usersToMigrate
  usersToMigrate.forEach((user, index) => {
    usersToMigrate[index].targetUserId = targetCognitoUsersMap[user.email]
  });

  return usersToMigrate;
};

const run = async (usersToMigrate, environment, sandboxId, sourceRegion, targetRegion, sourceLocalPort, targetLocalPort) => {
  // where users will be migrated from
  const sourceSqlClient = await createSqlClient(environment, sandboxId, sourceRegion, sourceLocalPort);

  // where users will be migrated to
  const targetSqlClient = await createSqlClient(environment, sandboxId, targetRegion, targetLocalPort);

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

} else if (!environment) {
  console.log('You need to specify what environment to run this on.');
  console.log('e.g.: npm run awsToAws -- --environment=staging');

} else {
  // ----------------------Dynamo dumps----------------------
  const sourceCognitoUsers = require(`${DOWNLOAD_FOLDER}/${sourceCognitoUserPoolId}.json`);
  const targetCognitoUsers = require(`${DOWNLOAD_FOLDER}/${targetCognitoUserPoolId}.json`);
  const createdUserEmails = require(`${DOWNLOAD_FOLDER}/test_user.json`).map(user => user.email);
  // ----------------------Dynamo dumps----------------------
  
  const usersToMigrate = getUsersToMigrate(sourceCognitoUsers, targetCognitoUsers, createdUserEmails)

  console.log(usersToMigrate)
  // run(usersToMigrate, environment, sandboxId, sourceRegion, targetRegion, sourceLocalPort, targetLocalPort)
  // .then(() => {
  //   console.log('>>>>--------------------------------------------------------->>>>');
  //   console.log('                     finished');
  //   console.log('>>>>--------------------------------------------------------->>>>');
  // }).catch((e) => console.log(e));


  
}
