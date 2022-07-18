var AWS = require('aws-sdk');

// Wanted to make this a wrapper class that extends S3,
// but it's not advisable to do so:
// https://github.com/aws/aws-sdk-js/issues/2006
const getS3Client = (profile, region, environment) => {

    const S3Config = {
        apiVersion: '2006-03-01',
        signatureVersion: 'v4',
        region
    };

    if (environment === 'development') {
        // use localstack s3
        S3Config.endpoint = 'http://localhost:4566'
        S3Config.sslEnabled = false
        S3Config.s3ForcePathStyle = true
    } else {
        // set profile
        var credentials = new AWS.SharedIniFileCredentials({ profile });
        AWS.config.credentials = credentials;

    }
    return new AWS.S3(S3Config);
};

module.exports = getS3Client;
