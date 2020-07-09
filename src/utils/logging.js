module.exports = {
  error: (error) => {
    console.error(error);
  },
  warn: (message) => {
    console.warn(message);
  },
  debug: (message) => {
    console.debug(message);
  },
  log: (message) => {
    console.log(message);
  },
  trace: (error) => {
    console.trace(error);
  },
};
