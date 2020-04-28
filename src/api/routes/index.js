const express = require('express');
const workRouter = require('./work');
const experimentRouter = require('./experiment');
const healthRouter = require('./health');

module.exports = () => {
  const app = express.Router();
  workRouter(app);
  experimentRouter(app);
  healthRouter(app);

  return app;
};
