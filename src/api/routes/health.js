const express = require('express');

const route = express.Router();

module.exports = (app) => {
  app.use('/health', route);

  route.get(
    '/',
    async (req, res) => {
      res.json({ wow: 'hi from health, I am healthy' });
    },
  );
};
