const express = require('express');
const workRouter = require('./routes/work');


module.exports = () => {
  const app = express.Router();
  workRouter(app);

  return app;
};
