const AWS = require('aws-sdk');

const getBucketNames = async (profile, environment) => {
    // set profile
    let credentials = new AWS.SharedIniFileCredentials({profile});
    AWS.config.credentials = credentials;

    let account;
    if (environment === 'development') {
        // use localstack s3
        account = '000000000000';
    } else {
        // set profile
        credentials = new AWS.SharedIniFileCredentials({ profile });
        AWS.config.credentials = credentials;
        
        // get account id
        const sts = new AWS.STS();
        const callerIdentity = await sts.getCallerIdentity({}).promise();
        account = callerIdentity.Account;
    }

    const bucketNames = {
    SAMPLE_FILES: `biomage-originals-${environment}-${account}`,
    PROCESSED_MATRIX: `processed-matrix-${environment}-${account}`,
    RAW_SEURAT: `biomage-source-${environment}-${account}`,
    CELL_SETS: `cell-sets-${environment}-${account}`,
    FILTERED_CELLS: `biomage-filtered-cells-${environment}-${account}`,
    WORKER_RESULTS: `worker-results-${environment}-${account}`,
    PLOTS: `plots-tables-${environment}-${account}`,
    };

    return bucketNames;
}

module.exports = getBucketNames;