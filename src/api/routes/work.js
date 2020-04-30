const WorkService = require('../../services/work');

module.exports = {
  'work#submit': (req, res) => {
    const workService = new WorkService(req.body);
    workService.submitWork();

    res.json({ wow: 'hi from work' });
  },
  'work#receive': (req, res) => {
    console.log(req.snsMessage);

    res.status(200);
  },
};
