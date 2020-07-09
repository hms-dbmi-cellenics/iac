const hash = require('object-hash');
const cache = require('../cache');

const createObjectHash = (object) => hash.MD5(object);

const cacheGetRequest = async (data, callback, socket) => {
  const key = createObjectHash(data);
  const payload = await cache.get(key);
  if (payload) {
    const { uuid, socketId } = data;
    socket.to(socketId).emit(`WorkResponse-${uuid}`, payload);
    return;
  }
  callback(data);
};


const cacheSetResponse = async (data, callback, ttl = 900) => {
  const key = createObjectHash(data);
  await cache.set(key, data, ttl);
  callback(data);
};

module.exports = { cacheGetRequest, cacheSetResponse };
