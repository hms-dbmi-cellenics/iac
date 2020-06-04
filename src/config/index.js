const dotenv = require('dotenv');
const AWS = require('aws-sdk');

// If we are not deployed on GitLab (AWS/k8s), the environment is given by
// NODE_ENV, or development if NODE_ENV is not set.

// If we are, assign NODE_ENV based on the GitLab (AWS/k8s cluster) environment.
// If NODE_ENV is set, that will take precedence over the GitLab
// environment.
if (process.env.GITLAB_ENVIRONMENT_NAME && !process.env.NODE_ENV) {
  switch (process.env.GITLAB_ENVIRONMENT_NAME) {
    case 'staging':
      process.env.NODE_ENV = 'production';
      process.env.CLUSTER_ENV = process.env.GITLAB_ENVIRONMENT_NAME;
      break;
    case 'production':
      process.env.NODE_ENV = 'production';
      process.env.CLUSTER_ENV = process.env.GITLAB_ENVIRONMENT_NAME;
      break;
    default:
      // We are probably on a review branch or other deployment.
      // Default to production for node environment and staging for
      // all cluster services.

      process.env.NODE_ENV = 'production';
      process.env.CLUSTER_ENV = 'staging';
      break;
  }
}

if (!process.env.GITLAB_ENVIRONMENT_NAME) {
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
}


const envFound = dotenv.config();
if (!envFound) {
  throw new Error("Couldn't find .env file");
}

async function getAwsAccountId() {
  const sts = new AWS.STS();

  const data = await sts.getCallerIdentity({}).promise();
  return data.Account;
}

// TODO: clusterEnv needs to be set to development when an AWS/k8s cluster
// is deployed for development.
module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  clusterEnv: process.env.CLUSTER_ENV || 'staging',
  awsRegion: process.env.AWS_DEFAULT_REGION || 'eu-west-2',
  awsAccountIdPromise: getAwsAccountId(),
  api: {
    prefix: '/',
  },
};
