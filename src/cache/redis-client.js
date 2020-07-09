const getMetaData = require('./aws-utilities');
const RedisWrapper = require('./redis-wrapper');
const logger = require('../utils/logging');

class RedisClient {
  constructor(options) {
    this.options = options;
    this.master = this.createClient(this.options.master.host, this.options.master.port);
    this.slave = this.master;
    this.tryReconfigureSlaveClient();
  }

  static getSlave(slaves, az) {
    for (let i = 0; i < slaves.length; i += 1) {
      if (slaves[i].az !== undefined && slaves[i].az === az) {
        return slaves[i];
      }
    }
    return null;
  }

  createClient(host, port) {
    const clientOptions = {
      host,
      port,
      retryDelay: this.options.retryDelay,
    };
    return new RedisWrapper(clientOptions);
  }

  async tryReconfigureSlaveClient() {
    try {
      if ((this.options.slaves || []).length > 0) {
        if (!this.options.skipAvailabilityZoneCheck) {
          const az = await getMetaData('placement/availability-zone');
          const slave = RedisClient.getSlave(this.options.slaves, az);
          if (slave) {
            this.slave = this.createClient(slave.host, slave.port);
          }
        } else {
          const slave = this.options.slaves[0];
          this.slave = this.createClient(slave.host, slave.port);
        }
      }
    } catch (error) {
      logger.error(error, 'switching to master redis as failed to get availability zone');
      logger.trace(error);
    }
  }
}

module.exports = RedisClient;
