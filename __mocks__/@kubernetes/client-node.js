const k8s = jest.genMockFromModule('@kubernetes/client-node');
const logger = require('../../src/utils/logging');

const mockApi = jest.fn(() => ({
  createNamespacedJob: jest.fn(() => {
    logger.log('creating a fake namespace obj');
    return new Promise((resolve) => {
      resolve({
        status: 200,
      });
    });
  }),
  createNamespacedPersistentVolumeClaim: jest.fn(() => {
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
    makeApiClient: mockApi,
  };
});

module.exports = k8s;
