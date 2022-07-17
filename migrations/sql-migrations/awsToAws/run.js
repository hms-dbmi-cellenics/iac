const _ = require('lodash');
const knexfileLoader = require('../knexfile');
const knex = require('knex');

const USER_POOL_ID = 'eu-west-1_eYTCV3Nl7'
const DOWNLOAD_FOLDER = '../cognito_backup'

const env = process.env.SOURCE_ENV || 'production'

// Cognito dumps 
const cognitoUsersJson = require(`${DOWNLOAD_FOLDER}/${USER_POOL_ID}.json`);

// TODO: get all emails that will be migrated
const emailsToMigrate = ['alex@biomage.net']


// TODO:
// this is for Biomage deployment
// adapt getConnectionParams.js so that can also get two deployments
const createSqlClient = async (activeEnvironment, sandboxId) => {
  const knexfile = await knexfileLoader(activeEnvironment, sandboxId);
  return knex.default(knexfile[activeEnvironment]);
}

const migrateUser = async (user, sqlClient) => {
  const { sub: userId, email } = user;

  console.log(`Migrating User:`)
  console.log(JSON.stringify(user));

  // get all experiment_id's for user
  const userAccessEntries = await sqlClient('user_access')
    .where('user_id', userId);

  // ----
  // TODO: update user_id to be for destination deployment
  // TODO: insert entries into user_acess table
  // ----

  // console.log('userAccessEntries:')
  // console.log(userAccessEntries)

  // migrate each experiment
  for (var i = 0; i < userAccessEntries.length; i++) {
    await migrateExperiment(userAccessEntries[i], sqlClient);
  }
};

const migrateExperiment = async (experiment, sqlClient) => {

  // get entries from experiment table
  const { experiment_id: experimentId } = experiment;

  console.log(`Migrating experiment:`)
  console.log(JSON.stringify(experiment));

  const experimentTableEntries = await sqlClient('experiment')
    .where('id', experimentId);


  console.log('experimentTableEntries:')
  console.log(experimentTableEntries)

};

const run = async (environment, sandboxId) => {
  // where users will be migrated from
  const sqlClient = await createSqlClient(environment, sandboxId);

  // TODO: create destinationSqlClient (aka knex for HMS deployment)

  // subset to users that will migrate
  const usersToMigrate = cognitoUsersJson
    .filter(user => {
      const emailAttribute = user.Attributes.filter(attr => attr.Name == "email");
      return emailsToMigrate.includes(emailAttribute[0].Value);
    })
    // only keep attributes: have everything we need and are flat
    .map(user => {
      const flatAttributes = {};
      user.Attributes.forEach(attr => flatAttributes[attr.Name] = attr.Value);
      return flatAttributes;
    })

  // migrate each user
  for (var i = 0; i < usersToMigrate.length; i++) {
    await migrateUser(usersToMigrate[i], sqlClient);
  };

};

const environment = process.env.TARGET_ENV || 'development';
const sandboxId = process.env.SANDBOX_ID || 'default';

console.log(`environment: ${environment}`)
console.log(`sandboxId: ${sandboxId}`)

if (!_.isNil(environment)) {
  run(environment, sandboxId)
    .then(() => {
      console.log('>>>>--------------------------------------------------------->>>>');
      console.log('                     finished');
      console.log('>>>>--------------------------------------------------------->>>>');
    }).catch((e) => console.log(e));
} else {
  console.log('You need to specify what environment to run this on.');
  console.log('e.g.: TARGET_ENV=staging npm run dynamoToSql');
}
