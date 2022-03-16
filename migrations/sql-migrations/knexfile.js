const getConnectionParams = require('./getConnectionParams');

// This is one of the shapes the knexfile can take https://knexjs.org/#knexfile
const fetchConfiguration = async (environment) => {
  const params = await getConnectionParams(environment);
  return {
    [environment]: {
      client: 'postgresql',
      connection: params,
      pool: { min: 0, max: 100 },
      acquireConnectionTimeout: 6000000
    },
  };
};

module.exports = async (env) => {
  const environment = env || process.env.NODE_ENV;
  
  const configuration = await fetchConfiguration(environment);
  return {
    ...configuration,
  };
};
