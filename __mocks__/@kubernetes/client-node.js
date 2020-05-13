/* eslint-env jest */
const k8s = jest.genMockFromModule('@kubernetes/client-node');

const mockBatchV1Api = jest.fn(() => ({
  createNamespacedJob: jest.fn(() => {
    console.log('creating a fake namespace obj');
    return new Promise((resolve, reject) => {
      resolve({
        status: 200,
      });
    });
  }),
}));

k8s.KubeConfig.mockImplementation(() => {
  console.log('mocking the constructor');
  return {
    loadFromDefault: jest.fn(),
    makeApiClient: mockBatchV1Api,
  };
});

k8s.makeApiClient = (x) => {
  console.log('in my awesome mock ', x);
  return x;
};


module.exports = k8s;
