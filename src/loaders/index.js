const expressLoader = require('./express');

module.exports = async (app) => {
  await expressLoader(app);
};
