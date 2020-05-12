// If we are not deployed on GitLab (AWS/k8s), the environment is given by
// NODE_ENV, or development if NODE_ENV is not set.

// If we are, assign NODE_ENV based on the GitLab (AWS/k8s cluster) environment.
// If NODE_ENV is set, that will take precedence over the GitLab
// environment.
process.env.NODE_ENV = 'test';

function getAwsAccountId() {
  return new Promise((resolve, reject) => {
    resolve('test-account-id');
  });
}

// TODO: clusterEnv needs to be set to development when an AWS/k8s cluster
// is deployed for development.
module.exports = {
  port: 3000,
  clusterEnv: 'test',
  awsRegion: 'eu-west-2',
  awsAccountIdPromise: getAwsAccountId(),
  api: {
    prefix: '/',
  },
};
