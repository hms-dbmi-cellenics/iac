const snsMiddleware = require('express-sns-validator');
const WorkService = require('../../services/work');


module.exports = {
  'work#submit': (req, res) => {
    const workService = new WorkService(req.body);
    workService.submitWork();

    res.json({ wow: 'hi from work' });
  },
  'work#receive': [snsMiddleware(), (req, res) => {
    res.status(200);
  }],
};
