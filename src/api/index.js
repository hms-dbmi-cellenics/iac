const express = require('express');
const workRouter = require('./routes/work');
const experimentRouter = require('./routes/experiment');
const healthRouter = require('./routes/health');

module.exports = () => {
  const app = express.Router();
  workRouter(app);
  experimentRouter(app);
  healthRouter(app);

  return app;
};
