const express = require('express');
const ExperimentService = require('../../services/experiment');

const route = express.Router();

module.exports = (app) => {
  app.use('/experiment', route);
  const experimentService = new ExperimentService();

  route.get('/generate', async (req, res) => {
    await experimentService.generateMockData();
    res.json({ wow: 'hi from experiment' });
  });

  route.get('/:experiment_id', async (req, res) => {
    const data = await experimentService.getExperimentData(req.params.experiment_id);
    res.json(data);
  });

  route.get('/:experiment_id/cell-sets', async (req, res) => {
    const data = await experimentService.getCellSets(req.params.experiment_id);
    res.json(data);
  });
};
