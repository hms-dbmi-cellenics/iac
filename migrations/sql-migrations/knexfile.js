const getConnectionParams = require('./getConnectionParams');

// This is one of the shapes the knexfile can take https://knexjs.org/#knexfile
const fetchConfiguration = async (environment, sandboxId, region, localPort, profile = 'default') => {
  const maxConnections = environment === 'development' ? 10 : 100;

  const params = await getConnectionParams(environment, sandboxId, region, localPort, profile);

  return {
    [environment]: {
      client: 'postgresql',
      connection: params,
      pool: { min: 0, max: maxConnections },
      acquireConnectionTimeout: 6000000,
      migrations: {
        directory: '../../../api/src/sql/migrations'
      }
    },
  };
};

module.exports = async (env, inputSandboxId, inputRegion, inputLocalPort, profile) => {
  const environment = env || process.env.NODE_ENV;
  const sandboxId = inputSandboxId || process.env.SANDBOX_ID;
  const region = inputRegion || process.env.REGION || 'eu-west-1';
  const localPort = inputLocalPort || (environment === 'development' ? 5431 : 5432);

  if (!sandboxId) {
    throw new Error("Please specify the sandboxId by using the SANDBOX_ID environment variable");
  }


  const configuration = await fetchConfiguration(environment, sandboxId, region, localPort, profile);
  return {
    ...configuration,
  };
};
