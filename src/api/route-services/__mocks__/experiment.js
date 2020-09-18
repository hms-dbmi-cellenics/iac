const mockExperimentData = jest.fn((experimentId) => new Promise((resolve) => {
  resolve({
    experimentId,
    experimentName: 'my mocky name',
  });
}));

const mockGetCellSets = jest.fn(() => new Promise((resolve) => {
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

const mockUpdateCellSets = jest.fn((experimentId, cellSetData) => new Promise((resolve) => {
  resolve(cellSetData);
}));

const mock = jest.fn().mockImplementation(() => ({
  getExperimentData: mockExperimentData,
  getCellSets: mockGetCellSets,
  updateCellSets: mockUpdateCellSets,
}));

module.exports = mock;
