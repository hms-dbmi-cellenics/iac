const handleWorkRequest = require('../event-services/work-request');
const logger = require('../../utils/logging');


module.exports = (socket) => {
  socket.on('WorkRequest', async (data) => {
    logger.log('Work submitted from client:', data);

    try {
      await handleWorkRequest(data, socket);
    } catch (e) {
      logger.error('Error while processing WorkRequest event:', e);
      logger.trace(e);
    }
  });
};
