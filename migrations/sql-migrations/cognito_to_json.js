var AWS = require('aws-sdk');
var { backupUsers, restoreUsers } = require('cognito-backup-restore');
var parseArgs = require('minimist');

// set defaults arguments so that backup production
var opts = { default: { region: 'eu-west-1' } };
const BACKUP_DIR = 'downloaded_data/aws_to_aws';

var argv = parseArgs(process.argv.slice(2), opts);
var { userPoolId, region } = argv;

if (!userPoolId) {
    console.log('You need to specify the user pool id to backup.');
    console.log('e.g.: node run cognito_to_json.js --userPoolId eu-west-1_abcd1234');
} else {
    // set region
    AWS.config.update({ region });

    const cognitoISP = new AWS.CognitoIdentityServiceProvider();

    // save backup of user pool
    backupUsers(cognitoISP, userPoolId, BACKUP_DIR)
        .then(() => console.log(`Backup completed`))
        .catch(console.error)

}
