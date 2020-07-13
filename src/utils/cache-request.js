const hash = require('object-hash');
const cache = require('../cache');

const createObjectHash = (object) => hash.MD5(object);

const cacheGetRequest = async (
  data,
  callback,
  socket,
) => {
  const { uuid, socketId } = data;
  const key = createObjectHash({
    experimentId: data.experimentId,
    body: data.body,
  });
  const payload = await cache.get(key);
  if (payload) {
    socket.to(socketId).emit(`WorkResponse-${uuid}`, payload);
    return;
  }
  await callback(data);
};


const cacheSetResponse = async (data, ttl = 900) => {
  const key = createObjectHash({
    experimentId: data.request.experimentId,
    body: data.request.body,
  });
  await cache.set(key, data, ttl);
};

module.exports = { cacheGetRequest, cacheSetResponse };
