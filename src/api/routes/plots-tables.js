const PlotsTablesService = require('../route-services/plots-tables');

const plotsTablesService = new PlotsTablesService();

module.exports = {
  'plots-tables#create': (req, res, next) => {
    const { experimentId, plotUuid, data } = req.params;

    plotsTablesService.create(experimentId, plotUuid, data)
      .then((response) => res.json(response))
      .catch(next);
  },
  'plots-tables#read': (req, res, next) => {
    const { experimentId, plotUuid } = req.params;

    plotsTablesService.read(experimentId, plotUuid)
      .then((response) => res.json(response))
      .catch(next);
  },
  'plots-tables#update': (req, res, next) => {
    const { experimentId, plotUuid, data } = req.params;

    plotsTablesService.create(experimentId, plotUuid, data)
      .then((response) => res.json(response))
      .catch(next);
  },
  'plots-tables#delete': (req, res, next) => {
    const { experimentId, plotUuid } = req.params;

    plotsTablesService.dekete(experimentId, plotUuid)
      .then((response) => res.json(response))
      .catch(next);
  },
};
