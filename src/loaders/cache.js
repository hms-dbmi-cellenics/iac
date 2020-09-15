const logger = require('../utils/logging');
const generateConfig = require('../cache/generate-config');
const CacheSingleton = require('../cache');

module.exports = async () => {
  logger.log('Generating configuration for cache...');
  const config = await generateConfig();

  logger.log(`Primary: ${config.primary.host}:${config.primary.port}, reader: ${config.reader.host}:${config.reader.port}`);

  CacheSingleton.get(config);

  logger.log('Cache instance created.');
};
