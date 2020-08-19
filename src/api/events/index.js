const handleWorkRequest = require('../event-services/work-request');
const handlePlotConfigRequest = require('../plots-config-service');
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
  socket.on('PlotConfigRequest', async (data) => {
    logger.log('Plot config requested from client:', data);

    try {
      await handlePlotConfigRequest(data, socket);
    } catch (e) {
      logger.error('Error while processing PlotConfigRequest event:', e);
      logger.trace(e);
    }
  });
};
