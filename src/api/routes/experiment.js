const ExperimentService = require('../../services/experiment');
const WorkService = require('../../services/work');

const experimentService = new ExperimentService();

module.exports = {
  'experiment#findByID': (req, res, next) => {
    experimentService.getExperimentData(req.params.experimentId)
      .then((data) => res.json(data))
      .catch(next);
  },
  'experiment#getCellSets': (req, res, next) => {
    experimentService.getCellSets(req.params.experimentId)
      .then((data) => res.json(data))
      .catch(next);
  },
  'experiment#generateMock': (_, res, next) => {
    experimentService.generateMockData()
      .then((r) => res.json(r))
      .catch((e) => {
        res.status(500).json({ error: e });
      })
      .catch(next);
  },
  'work#submit': (req, res) => {
    const workService = new WorkService(req.body);
    workService.submitWork();

    res.json({ wow: 'hi from work' });
  },
};
