const now = () => new Date();

const bypassCache = {
  set: () => { },
  get: () => undefined,
};

module.exports = { now, bypassCache };
