/* eslint-env jest */

const mockExperimentData = jest.fn((x) => new Promise((resolve, reject) => {
  resolve({
    experimentId: x,
    experimentName: 'my mocky name',
  });
}));

const mockGenerateMockData = jest.fn((x) => new Promise((resolve, reject) => {
  resolve({
    everything: 'is fine',
  });
}));

const mockGetCellSets = jest.fn((x) => new Promise((resolve, reject) => {
  resolve({
    cellSets: [
      {
        color: 'white',
        name: 'Cell types',
        key: 1,
        children: [
          {
            color: 'blue',
            key: 7,
            name: 'some cells',
          },
          {
            color: 'red',
            key: 8,
            name: 'some other cells',
          },
        ],
      },
      {
        color: 'black',
        name: 'amazing cells',
        key: 3,
      },
    ],
  });
}));

const mock = jest.fn().mockImplementation(() => ({
  getExperimentData: mockExperimentData,
  getCellSets: mockGetCellSets,
  generateMockData: mockGenerateMockData,
}));

module.exports = mock;
