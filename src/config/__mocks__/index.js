// If we are not deployed on GitLab (AWS/k8s), the environment is given by
// NODE_ENV, or development if NODE_ENV is not set.

// If we are, assign NODE_ENV based on the GitLab (AWS/k8s cluster) environment.
// If NODE_ENV is set, that will take precedence over the GitLab
// environment.
process.env.NODE_ENV = 'test';

function getAwsAccountId() {
  return new Promise((resolve) => {
    resolve('test-account-id');
  });
}

module.exports = {
  port: 3000,
  clusterEnv: 'test',
  awsRegion: 'eu-west-1',
  awsAccountIdPromise: getAwsAccountId(),
  api: {
    prefix: '/',
  },
};
