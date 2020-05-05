/* eslint-disable no-console */
require('log-timestamp');
const express = require('express');
const expressLoader = require('./loaders/express');
const config = require('./config');

async function startServer() {
  const { app, server, socketIo: io } = await expressLoader(express());
  app.set('io', io);

  console.log(process.env);

  // Set up handlers for SocketIO events.
  io.on('connection', (socket) => {
    console.log('connected');
    // eslint-disable-next-line global-require
    require('./api/events')(socket);
  });

  // Set up HTTP server.
  server.listen(config.port, (err) => {
    if (err) {
      process.exit(1);
    }
    console.log(`NODE_ENV: ${process.env.NODE_ENV}, cluster env: ${config.clusterEnv}`);
    console.log(`Server listening on port: ${config.port}`);
  });
}

startServer();
