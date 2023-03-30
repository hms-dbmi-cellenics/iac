const path = require('path')
const getConnectionParams = require('./getConnectionParams');

// This is one of the shapes the knexfile can take https://knexjs.org/#knexfile
const fetchConfiguration = async (environment, sandboxId, region) => {
  const params = await getConnectionParams(environment, sandboxId, region);

  let migrationsDir = path.join(__dirname, '..', 'sql', process.env.NODE_ENV)

  if (environment === 'development' || (environment == 'staging' && sandboxId !== 'default')) {
    migrationsDir = '../../../api/src/sql/migrations'
  }

  return {
    [environment]: {
      client: 'postgresql',
      connection: params,
      pool: { min: 0, max: 100 },
      acquireConnectionTimeout: 6000000,
      migrations: {
        directory: migrationsDir
      }
    },
  };
};

module.exports = async () => {
  const environment = process.env.NODE_ENV;
  const sandboxId = process.env.SANDBOX_ID;
  const region = process.env.AWS_REGION;

  if (!environment || !sandboxId || !region) {
    throw new Error("Please specify the NODE_ENV, SANDBOX_ID and AWS_REGION environment values");
  }

  const configuration = await fetchConfiguration(environment, sandboxId, region);
  return {
    ...configuration,
  };
};
