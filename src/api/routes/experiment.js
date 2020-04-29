const ExperimentService = require('../../services/experiment');
const WorkService = require('../../services/work');

const experimentService = new ExperimentService();

module.exports = {
  'experiment#findByID': async (req, res) => {
    const data = await experimentService.getExperimentData(req.params.experimentId);
    res.json(data);
  },
  'experiment#getCellSets': async (req, res) => {
    const data = await experimentService.getCellSets(req.params.experimentId);
    res.json(data);
  },
  'experiment#generateMock': async (req, res) => {
    await experimentService.generateMockData();
    res.json({ wow: 'hi from experiment' });
  },
  'work#submit': (req, res) => {
    const workService = new WorkService(req.body);
    workService.submitWork();

    res.json({ wow: 'hi from work' });
  },
};
