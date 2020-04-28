const express = require('express');
const WorkService = require('../../services/work');

const route = express.Router();

module.exports = (app) => {
  app.use('/work', route);

  route.post(
    '/',
    async (req, res) => {
      const workService = new WorkService(req.body);
      workService.submitWork();

      res.json({ wow: 'hi' });
    },
  );
};
