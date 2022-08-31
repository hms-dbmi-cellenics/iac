// npm run migrateAdminSub -- \
//  --sourceAdminSub 032abd44-0cd3-4d58-af21-850ca0b95ac7 \
//  --targetAdminSub a01e8bcc-c9a2-4c56-bd66-39de93764be8 \
//  --environment production \
//  --region region \
//  --localPort 5432 \
//  --profile hms

const _ = require('lodash');
const knexfileLoader = require('../knexfile');
const knex = require('knex');
const parseArgs = require('minimist');

// set defaults command line arguments

const opts = {
    default: {
        sandboxId: 'default',
        region: 'us-east-1',
        environment: 'development',
        localPort: 5432
    }
}

// get command line arguments
const argv = parseArgs(process.argv.slice(2), opts);

// set target local port
// 5431 for inframock
// 5433 for production target
argv.localPort = argv.localPort || (argv.targetEnvironment === 'development' ? 5431 : 5432);

console.log(`Command line arguments:\n=====`)
console.log(JSON.stringify(argv, null, 2))
console.log(`=====\n\n`)

// destructure command line args
const {
    environment,
    region,
    localPort,
    sourceAdminSub,
    targetAdminSub,
    profile,
    sandboxId,
} = argv;

const migrateAdminSub = async (environment, sandboxId, region, localPort, profile, sourceAdminSub, targetAdminSub) => {

    let sqlClient = await createSqlClient(environment, sandboxId, region, localPort, profile);

    // get user access entries with source admin sub
    const adminAccessEntries = await sqlClient('user_access')
        .where('user_id', sourceAdminSub);

    // add correct admin sub
    // insert admin role
    const updatedAdminAccessEntries = adminAccessEntries
        .map(adminAccessEntry => ({ ...adminAccessEntry, user_id: targetAdminSub }));

    sqlInsert(sqlClient, updatedAdminAccessEntries, 'user_access');

    // delete old entry
    await sqlDelete(sqlClient, 'user_id', sourceAdminSub, 'user_access');

};


const createSqlClient = async (activeEnvironment, sandboxId, region, localPort, profile) => {
    const knexfile = await knexfileLoader(activeEnvironment, sandboxId, region, localPort, profile);
    return knex.default(knexfile[activeEnvironment]);
};



const sqlInsert = async (sqlClient, sqlObject, tableName, extraLoggingData = {}) => {

    if (!sqlObject.length) {
        // console.log(`nothing to insert: ${sqlObject}`);
        return;
    }

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
};

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
};


migrateAdminSub(environment, sandboxId, region, localPort, profile, sourceAdminSub, targetAdminSub)
    .then(() => {
        console.log('>>>>--------------------------------------------------------->>>>');
        console.log('                     finished');
        console.log('>>>>--------------------------------------------------------->>>>');
    }).catch((e) => console.log(e));

