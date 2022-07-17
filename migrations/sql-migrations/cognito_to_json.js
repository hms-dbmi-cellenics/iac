var AWS = require('aws-sdk');
var { backupUsers, restoreUsers } = require('cognito-backup-restore');
var parseArgs = require('minimist');

// set defaults arguments so that backup production
var opts = {
    default: {
        backupDir: 'cognito_backup',
        userPoolId: 'eu-west-1_eYTCV3Nl7',
        region: 'eu-west-1'
    }
}

var argv = parseArgs(process.argv.slice(2), opts);
console.log(argv);
var { userPoolId, backupDir, region } = argv;

// set region
AWS.config.update({ region });

const cognitoISP = new AWS.CognitoIdentityServiceProvider();

// save backup of user pool
backupUsers(cognitoISP, userPoolId, backupDir)
    .then(() => console.log(`Backup completed`))
    .catch(console.error)