const ExperimentService = require('../../services/experiment');
const WorkService = require('../../services/work');

const experimentService = new ExperimentService();

module.exports = {
  'experiment#findByID': (req, res) => {
    experimentService.getExperimentData(req.params.experimentId)
      .then((data) => res.json(data));
  },
  'experiment#getCellSets': (req, res) => {
    experimentService.getCellSets(req.params.experimentId)
      .then((data) => res.json(data));
  },
  'experiment#generateMock': (req, res) => {
    experimentService.generateMockData()
      .then((r) => res.json(r))
      .catch((e) => {
        res.status(500).json({ error: e });
      });
  },
  'work#submit': (req, res) => {
    const workService = new WorkService(req.body);
    workService.submitWork();

    res.json({ wow: 'hi from work' });
  },
};
