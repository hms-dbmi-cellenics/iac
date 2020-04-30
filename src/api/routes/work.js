const https = require('https');

const MessageValidator = require('sns-validator');
const WorkService = require('../../services/work');

const validator = new MessageValidator();

module.exports = {
  'work#submit': (req, res) => {
    const workService = new WorkService(req.body);
    workService.submitWork();

    res.json({ wow: 'hi from work' });
  },
  'work#receive': [(req, res) => {
    let msg;

    try {
      msg = JSON.parse(req.body);
    } catch (error) {
      res.status(500).body('nok');
    }

    validator.validate(msg, (err, message) => {
      if (err) {
        return;
      }

      if (message.Type === 'SubscriptionConfirmation'
        || message.Type === 'UnsubscribeConfirmation') {
        https.get(message.SubscribeURL);
      }

      if (message.Type === 'Notification') {
        console.log(message);
      }
    });

    res.status(200).body('ok');
  }],
};
