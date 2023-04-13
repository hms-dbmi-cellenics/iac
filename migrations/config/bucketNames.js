const clusterEnv = process.env.NODE_ENV;
const awsAccountId = process.env.AWS_ACCOUNT_ID;

const bucketNames = {
  SAMPLE_FILES: `biomage-originals-${clusterEnv}-${awsAccountId}`,
  PROCESSED_MATRIX: `processed-matrix-${clusterEnv}-${awsAccountId}`,
  RAW_SEURAT: `biomage-source-${clusterEnv}-${awsAccountId}`,
  CELL_SETS: `cell-sets-${clusterEnv}-${awsAccountId}`,
  FILTERED_CELLS: `biomage-filtered-cells-${clusterEnv}-${awsAccountId}`,
  WORKER_RESULTS: `worker-results-${clusterEnv}-${awsAccountId}`,
  PLOTS: `plots-tables-${clusterEnv}-${awsAccountId}`,
};

module.exports = bucketNames;
