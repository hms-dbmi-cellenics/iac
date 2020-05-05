/* eslint-disable no-console */
const https = require('https');

const MessageValidator = require('sns-validator');
const WorkResponseService = require('../route-services/work-response');

const validator = new MessageValidator();

module.exports = {
  'work#response': async (req, res) => {
    let msg;

    console.log('message received', req.body);

    /*
    // First let's try parsing the body. It should be JSON.
    try {
      msg = JSON.parse(req.body);
    } catch (error) {
      console.log(error);
      res.status(500).send('nok');
      return;
    }

    console.log('message parsed');

    // Asynchronously validate and process the message.
    validator.validate(msg, (err, message) => {
      // Ignore errors.
      if (err) {
        console.error(
          'Error validating the SNS response: ', err,
        );
        return;
      }

      // Handle subscripton and unsubscription automatically.
      if (message.Type === 'SubscriptionConfirmation'
        || message.Type === 'UnsubscribeConfirmation') {
        https.get(message.SubscribeURL);
      }

      // Notifications are passed on to the service for processing.
      if (message.Type === 'Notification') {
        console.log('notification type message');


        try {
          const io = req.app.get('io');

          const workResult = JSON.parse(message.Message);

          console.log('workresult parsed');


          const responseService = new WorkResponseService(io, workResult);
          responseService.handleResponse();
        } catch (e) {
          console.error(
            'Error processing the work response message: ', e,
          );
        }
      }
    });

    // SNS is really dumb, so we can just send back a generic response.
    // It doesn't really care what we do afterwards.
    res.status(200).send('ok');
    */
  },
};
