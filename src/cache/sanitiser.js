const getInstances = require('./cache-instances');

const DEFAULT_RETRY_DELAY = 10000;
const DEFAULT_REDIS_GET_TIMEOUT = 3000; // in millis
const L1_DEFAULT_MIN_LATENCY_TO_STORE = 50; // in millis
const L1_DEFAULT_SIZE = 1000; // in number of items
const L1_DEFAULT_TTL = 60 * 1000; // 1 minute in millis
const REDIS_DEFAULT_TTL = 60; // 1 minute in millis

const hasProperty = (obj, property) => typeof (obj[property]) !== 'undefined';

const sanitiseL1CacheSettings = () => {
  const settings = {};
  const defaultTtl = L1_DEFAULT_TTL;
  settings.ttl = defaultTtl;
  const defaultSize = L1_DEFAULT_SIZE;
  settings.size = defaultSize;
  const defaultMinLatencyToStore = L1_DEFAULT_MIN_LATENCY_TO_STORE;
  settings.minLatencyToStore = defaultMinLatencyToStore;
  return settings;
};

const sanitiseGlobalConfiguration = (conf) => {
  const configuration = conf || {};
  configuration.cacheDuration = hasProperty(configuration, 'cacheDuration')
    ? configuration.cacheDuration
    : REDIS_DEFAULT_TTL;
  configuration.master = hasProperty(configuration, 'master')
    ? configuration.master
    : null;
  configuration.slaves = hasProperty(configuration, 'slaves')
    ? configuration.slaves
    : null;
  configuration.retryDelay = hasProperty(configuration, 'retryDelay')
    && configuration.retryDelay > DEFAULT_RETRY_DELAY
    ? configuration.retryDelay
    : DEFAULT_RETRY_DELAY;
  configuration.skipAvailabilityZoneCheck = hasProperty(configuration, 'skipAvailabilityZoneCheck')
    ? configuration.skipAvailabilityZoneCheck
    : false;
  configuration.redisGetTimeout = configuration.redisGetTimeout || DEFAULT_REDIS_GET_TIMEOUT;

  configuration.l1CacheSettings = sanitiseL1CacheSettings();

  if (!configuration.master) {
    const instances = getInstances();
    if (instances) {
      configuration.master = instances.master;
      configuration.slaves = instances.slaves;
    } else {
      throw new Error('No Redis instances defined');
    }
  }
  return configuration;
};

module.exports = sanitiseGlobalConfiguration;
