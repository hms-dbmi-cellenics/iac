const WorkRequestService = require('../event-services/work-request');
const logger = require('../../utils/logging');
const { cacheGetRequest } = require('../../utils/cache-request');

const handleRequestCallback = async (data) => {
  const requestService = new WorkRequestService(data);
  await requestService.handleRequest();
};

module.exports = (socket) => {
  socket.on('WorkRequest', async (data) => {
    logger.log('We have work', data);
    try {
      await cacheGetRequest(
        data,
        handleRequestCallback,
        socket,
      );
    } catch (e) {
      logger.error('Error while creating WorkRequest event:', e);
      logger.trace(e);
    }
  });
};
