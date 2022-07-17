const _ = require('lodash');
const knexfileLoader = require('../knexfile');
const knex = require('knex');

const USER_POOL_ID = 'eu-west-1_eYTCV3Nl7'
const DOWNLOAD_FOLDER = '../cognito_backup'

// TODO: adapt Helper
const Helper = require('./Helper');

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

const run = async (environment, sandboxId) => {
  // where users will be migrated from
  // const sourceSqlClient = await createSqlClient(environment);


  // TODO: create destination destinationSqlClient

  const usersToMigrate = cognitoUsersJson.filter(user => {
    const emailAttribute = user.Attributes.filter(attr => attr.Name == "email");
    return emailsToMigrate.includes(emailAttribute[0].Value);
  })

  console.log(`usersToMigrate:`)
  console.log(JSON.stringify(usersToMigrate))


  // const helper = new Helper(sqlClient);

  // await migrateProjects(projectsJson, helper);

  // await Promise.all([
  //   migrateUserAccess(sqlClient, userAccessJson),
  //   migrateInviteAccess(sqlClient, inviteAccessJson),
  //   migratePlots(sqlClient, plotsJson)
  // ]);
};

const environment = process.env.TARGET_ENV || 'development';
const sandboxId = process.env.SANDBOX_ID || 'default';

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
