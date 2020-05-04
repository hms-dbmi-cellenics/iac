const WorkRequestService = require('../event-services/work-request');

module.exports = (socket) => {
  socket.on('WorkRequest', (data) => {
    console.log('We have work', data);
    try {
      const requestService = new WorkRequestService(data);
      requestService.handleRequest();
    } catch (e) {
      console.log('Error while parsing schema for WorkRequest event:', e);
    }
  });
};
