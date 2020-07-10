const WorkRequestService = require('../event-services/work-request');
const logger = require('../../utils/logging');

module.exports = (socket) => {
  socket.on('WorkRequest', async (data) => {
    logger.log('We have work', data);
    try {
      const requestService = new WorkRequestService(data);
      await requestService.handleRequest();
    } catch (e) {
      logger.error('Error while parsing schema for WorkRequest event:', e);
      logger.trace(e);
    }
  });
};
