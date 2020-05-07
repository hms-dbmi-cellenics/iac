/* eslint-env jest */

const mockExperimentData = jest.fn((x) => new Promise((resolve, reject) => {
  resolve({
    experimentId: x,
    experimentName: 'my mocky name',
  });
}));


const mock = jest.fn().mockImplementation(() => ({ getExperimentData: mockExperimentData }));

module.exports = mock;
