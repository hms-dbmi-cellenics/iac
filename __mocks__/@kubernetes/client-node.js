const k8s = jest.genMockFromModule('@kubernetes/client-node');
const logger = require('../../src/utils/logging');

const mockBatchV1Api = jest.fn(() => ({
  createNamespacedJob: jest.fn(() => {
    logger.log('creating a fake namespace obj');
    return new Promise((resolve) => {
      resolve({
        status: 200,
      });
    });
  }),
}));

k8s.KubeConfig.mockImplementation(() => {
  logger.log('mocking the constructor');
  return {
    loadFromDefault: jest.fn(),
    makeApiClient: mockBatchV1Api,
  };
});

k8s.makeApiClient = (x) => {
  logger.log('in my awesome mock ', x);
  return x;
};


module.exports = k8s;
