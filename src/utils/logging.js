module.exports = {
  error: (...args) => {
    console.error(args);
  },
  warn: (...args) => {
    console.warn(args);
  },
  debug: (...args) => {
    console.debug(args);
  },
  log: (...args) => {
    console.log(args);
  },
  trace: (...args) => {
    console.trace(args);
  },
};
