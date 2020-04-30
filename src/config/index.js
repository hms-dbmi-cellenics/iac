const dotenv = require('dotenv');

// If we are not deployed on GitLab (AWS/k8s), the environment is given by
// NODE_ENV, or development if NODE_ENV is not set.

// If we are, assign NODE_ENV based on the GitLab (AWS/k8s cluster) environment.
// If NODE_ENV is set, that will take precedence over the GitLab
// environment.
if (process.env.GITLAB_ENVIRONMENT_NAME && !process.env.NODE_ENV) {
  switch (process.env.GITLAB_ENVIRONMENT_NAME) {
    case 'development':
      process.env.NODE_ENV = 'development';
      break;
    case 'staging':
      process.env.NODE_ENV = 'production';
      break;
    case 'production':
      process.env.NODE_ENV = 'production';
      break;
    default:
      process.env.NODE_ENV = 'production';
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

// TODO: clusterEnv needs to be set to development when an AWS/k8s cluster
// is deployed for development.
module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  clusterEnv: process.env.GITLAB_ENVIRONMENT_NAME || 'staging';
  api: {
    prefix: '/',
  },
};
