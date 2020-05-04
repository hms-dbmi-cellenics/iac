const ExperimentService = require('../route-services/experiment');

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
};
