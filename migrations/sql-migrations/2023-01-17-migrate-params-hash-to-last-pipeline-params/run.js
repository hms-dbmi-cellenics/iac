const _ = require('lodash');
const knexfileLoader = require('../knexfile');
const knex = require('knex');
const chalk = require('chalk');
const objectHash = require('object-hash');

const fs = require('fs');
const { exit } = require('process');

const CELL_SETS_DIR = '2023-01-17-migrate-params-hash-to-last-pipeline-params/cellSets';

const tableNames = {
  EXPERIMENT: 'experiment',
  EXPERIMENT_EXECUTION: 'experiment_execution',
  SAMPLE: 'sample',
  SAMPLE_FILE: 'sample_file',
  USER_ACCESS: 'user_access',
  INVITE_ACCESS: 'invite_access',
  METADATA_TRACK: 'metadata_track',
  PLOT: 'plot',
  SAMPLE_IN_METADATA_TRACK_MAP: 'sample_in_metadata_track_map',
  SAMPLE_TO_SAMPLE_FILE_MAP: 'sample_to_sample_file_map',
};

const sampleFields = [
  'id',
  'experiment_id',
  'name',
  'sample_technology',
  'options',
  'created_at',
  'updated_at',
];

const replaceNullsWithObject = (object, nullableKey) => (
  `COALESCE(
      ${object}
      FILTER(
        WHERE ${nullableKey} IS NOT NULL
      ),
      '{}'::jsonb
    )`
);

const getSamples = async (experimentId, knex) => {
  const metadataObject = `${replaceNullsWithObject('jsonb_object_agg(key, value)', 'key')} as metadata`;

  const sampleFieldsWithAlias = sampleFields.map((field) => `s.${field}`);

  const metadataQuery = knex.select([...sampleFields, knex.raw(metadataObject)])
    .from(knex.select([...sampleFieldsWithAlias, 'm.key', 'sm_map.value'])
      .from({ s: tableNames.SAMPLE })
      .leftJoin(`${tableNames.METADATA_TRACK} as m`, 's.experiment_id', 'm.experiment_id')
      .leftJoin(`${tableNames.SAMPLE_IN_METADATA_TRACK_MAP} as sm_map`, { 's.id': 'sm_map.sample_id', 'm.id': 'sm_map.metadata_track_id' })
      .where('s.experiment_id', experimentId)
      .as('mainQuery'))
    .groupBy(sampleFields)
    .as('select_metadata');

  const sampleFileFields = ['sample_file_type', 'size', 'upload_status', 's3_path'];
  const sampleFileFieldsWithAlias = sampleFileFields.map((field) => `sf.${field}`);
  const fileObjectFormatted = sampleFileFields.map((field) => [`'${field}'`, field]);

  // Add sample file id (needs to go separate to avoid conflict with sample id)
  sampleFileFieldsWithAlias.push('sf.id as sf_id');
  fileObjectFormatted.push(['\'id\'', 'sf_id']);

  const sampleFileObject = `jsonb_object_agg(sample_file_type,json_build_object(${fileObjectFormatted})) as files`;
  const fileNamesQuery = knex.select(['id', knex.raw(sampleFileObject)])
    .from(knex.select([...sampleFileFieldsWithAlias, 's.id'])
      .from({ s: tableNames.SAMPLE })
      .join(`${tableNames.SAMPLE_TO_SAMPLE_FILE_MAP} as sf_map`, 's.id', 'sf_map.sample_id')
      .join(`${tableNames.SAMPLE_FILE} as sf`, 'sf.id', 'sf_map.sample_file_id')
      .where('s.experiment_id', experimentId)
      .as('mainQuery'))
    .groupBy('id')
    .as('select_sample_file');

  const result = await knex.select('*')
    .queryContext({ camelCaseExceptions: ['metadata'] })
    .from(metadataQuery)
    .join(fileNamesQuery, 'select_metadata.id', 'select_sample_file.id');

  return result;
};

const readCellSets = async (filePath) => {
  let raw = fs.readFileSync(filePath);
  const { cellSets } = JSON.parse(raw);

  return cellSets;
};

let hasAllCellIds = (subarray, containerSet) => subarray.every(v => containerSet.has(v));

const getValueForSample = (experimentId, trackKey, trackCellSets, sampleData) => {
  const { cellIds: sampleCellIds } = sampleData;

  const samplesValue = trackCellSets.find(({ key, cellIds: valueCellIds }) => {
    // console.log(`STILL RUNNING ${sampleCellIds.length}, ${valueCellIds.length}`);

    // Each cellId is in only in one metadata track, so if we find where the first cellId is
    //  then we can assume all the other ones are there too
    const includes = valueCellIds.includes(sampleCellIds[0]);

    if (includes) {
      if (!hasAllCellIds(sampleCellIds, new Set(valueCellIds))) {
        console.error(
          chalk.red(
            `
        ---------------------[ERROR]---------------------
          experiment: ${experimentId}, 
          sample: ${sampleData.key}
          metadataTrack: ${trackKey}
          metadataValue: ${key}
          
          Metadata value has some cellIds of the sample but not all
        -------------------------------------------------
    `
          )
        );

        throw new Error('Metadata value has some cellIds of the sample but not all');
      }
    }

    return includes;
  });

  return samplesValue.key;
}

const getMetadata = async (experimentId, sortedSamplesData, metadataTracks) => {
  // console.log(`Begun getMetadata for experiment: ${experimentId}`);
  const metadata = metadataTracks.reduce((metadataTracksAcum, { key, children: trackCellSets }) => {
    const trackValues = [];

    sortedSamplesData.forEach((sampleData) => {
      const sampleValue = getValueForSample(experimentId, key, trackCellSets, sampleData);

      // In the cellsets, the metadata values have this format: `${track}-${value}`
      //  Everywhere else they have the format `${value}`, so remove the first appearance of `${track}-`
      const sampleValueCleaned = sampleValue.replace(`${key}-`, '');

      trackValues.push(sampleValueCleaned);
    });

    metadataTracksAcum[key] = trackValues;
    return metadataTracksAcum;
  }, {});

  // console.log(`Finished getMetadata for experiment: ${experimentId}`);

  return metadata;
}

// We need to get the names of the samples from currentPipelineParams when possible
//  to guarantee that people renaming the sample in their cellSets (but not in data management)
//  won't cause a wrong "Process project" button
const getSampleNames = (currentPipelineParams, latestSampleIds, latestSampleNames) => {
  return latestSampleIds.map((sampleId, index) => {
    const currentIndex = currentPipelineParams.sampleIds.indexOf(sampleId);

    // If the sample id isn't in the current params, then just return the name we have in cell sets
    // It doesn't matter that much becuase that means a sample was deleted, 
    // so it will have "Process project" anyways
    if (currentIndex === -1) return latestSampleNames[index];

    return currentPipelineParams.sampleNames[currentIndex];
  });
}

const getLatestSeuratRunParams = async (currentPipelineParams, execution) => {
  const currentHashParams = {
    organism: null,
    ...currentPipelineParams,
  }

  // seurat object didn't have metadata during hashing
  delete currentHashParams.metadata

  const currentHash = objectHash.sha1(
    _.cloneDeep(currentHashParams),
    { unorderedObjects: true, unorderedArrays: true, unorderedSets: true },
  );

  const latestSeuratStatus = execution.last_status_response.seurat.status;
  const latestHash = execution.params_hash;

  if (latestSeuratStatus === 'SUCCEEDED' && latestHash == currentHash) {
    return currentPipelineParams;
  } else {
    return null;
  }
}

const getLatestGem2sRunParams = async (experimentId, currentPipelineParams) => {
  const cellSets = await readCellSets(`${CELL_SETS_DIR}/${experimentId}`);

  const samplesData = _.find(cellSets, { key: 'sample' }).children;
  // sortedSamplesData looks like: [{key: 'sample-0', ...}, {key: 'sample-1', ...}]
  const sortedSamplesData = _.sortBy(samplesData, ['key']);

  // Any cell class of type metadataCategorical (and not sample) is a metadata
  const metadataTracks = cellSets.filter(({ type, key }) => type === 'metadataCategorical' && key !== 'sample');

  const sampleIds = _.map(sortedSamplesData, 'key');
  const sampleNames = _.map(sortedSamplesData, 'name');

  return {
    sampleTechnology: currentPipelineParams.sampleTechnology,
    sampleIds: sampleIds,
    sampleNames: getSampleNames(currentPipelineParams, sampleIds, sampleNames),
    // Checked, all 10x have lists of {}, all the real rhapsody exps 
    //  have "go to data processing" in the button, so we can just copy it from here
    // Also, sampleOptions is the same value for all samples, 
    //  so we don't need to find the relevant sample like with sampleName
    sampleOptions: currentPipelineParams.sampleOptions.slice(0, sortedSamplesData.length),
    metadata: await getMetadata(experimentId, sortedSamplesData, metadataTracks),
  };
};

const getCurrentPipelineParams = async (experimentId, knex) => {
  const samples = await getSamples(experimentId, knex);

  const samplesObj = samples.reduce(
    (acc, current) => {
      acc[current.id] = current;
      return acc;
    },
    {},
  );

  const { sample_technology: sampleTechnology = undefined, metadata = {} } = samples[0] ?? {};

  const sampleIds = _.sortBy(Object.keys(samplesObj));
  const sampleNames = sampleIds.map((id) => samplesObj[id].name);
  const sampleOptions = sampleIds.map((id) => samplesObj[id].options);

  // Handle metadata
  const metadataInvariant = Object.keys(metadata).sort();
  const metadataField = metadataInvariant.reduce(
    (acc, current) => {
      const sanitizedKey = current.replace(/-+/g, '_');

      const entries = sampleIds.map((id) => samplesObj[id].metadata[current]);
      acc[sanitizedKey] = entries;
      return acc;
    },
    {},
  );

  return {
    sampleTechnology,
    sampleIds,
    sampleNames,
    sampleOptions,
    metadata: metadataField,
  };
};


const startMigration = async (sqlClient, pipelineType) => {
  const pipelineExecutions = await sqlClient
    .select()
    .from(tableNames.EXPERIMENT_EXECUTION)
    .where({ pipeline_type: pipelineType });

  const missingExps = new Set(_.range(pipelineExecutions.length));

  const experimentIdsToPrint = [];

  await Promise.all(
    pipelineExecutions
      .map(async (execution, index) => {
        const { experiment_id: experimentId } = execution;

        try {
          const currentPipelineParams = await getCurrentPipelineParams(experimentId, sqlClient);

          let latestPipelineParams;
          if (pipelineType === 'gem2s') {
            latestPipelineParams = await getLatestGem2sRunParams(experimentId, currentPipelineParams);
            experimentIdsToPrint.push(experimentId);
          } else if (pipelineType === 'seurat') {
            latestPipelineParams = await getLatestSeuratRunParams(currentPipelineParams, execution);
          }

          const equalParams = _.isEqual(currentPipelineParams, latestPipelineParams);

          if (!equalParams) {
            console.log(chalk.yellow('-----experimentIdDebug'));
            console.log(experimentId);

            console.log(chalk.yellow('-----currentPipelineParamsDebug'));
            console.log(currentPipelineParams);

            console.log(chalk.yellow('-----latestPipelineRunParamsDebug'));
            console.log(latestPipelineParams);

            console.log(chalk.yellow('Are they equal?'));
            console.log(`Equal: ${equalParams}`);

            // experimentIdsToPrint.push(experimentId);

            console.log(chalk.yellow('------------------------------------------'));
          }

          missingExps.delete(index);
          console.log(`Experiments missing: ${missingExps.size}`);

          await sqlClient(tableNames.EXPERIMENT_EXECUTION)
            .update({ last_pipeline_params: latestPipelineParams })
            .where({
              pipeline_type: pipelineType,
              experiment_id: experimentId,
            });

        } catch (e) {
          if (e.code === 'ENOENT') {
            console.log(`Experiment ${experimentId}, cell sets not found`);
          } else {
            console.log(chalk.red(`Experiment: ${experimentId}. Error: `));
            console.log(e);
          }

          missingExps.delete(index);
        }
      }),
  );

  console.log('experimentIdsToPrint!')
  console.log(experimentIdsToPrint)
}


const createSqlClient = async (activeEnvironment, sandboxId) => {
  const knexfile = await knexfileLoader(activeEnvironment, sandboxId);
  return knex.default(knexfile[activeEnvironment]);
}

const run = async () => {
  const environment = process.env.TARGET_ENV;
  const sandboxId = process.env.SANDBOX_ID;
  const pipelineType = process.env.PIPELINE_TYPE;

  if (!_.isNil(environment) && !_.isNil(sandboxId) && !_.isNull(pipelineType)) {
    sqlClient = await createSqlClient(environment, sandboxId);

    console.log('Created SQL client');

    await startMigration(sqlClient, pipelineType);

    console.log('>>>>--------------------------------------------------------->>>>');
    console.log('                     Finished');
    console.log('>>>>--------------------------------------------------------->>>>');

    exit();
  } else {
    console.log('You need to specify what environment to run this on.');
    console.log('e.g.: TARGET_ENV=staging SANDBOX_ID=<sandbox_id> PIPELINE_TYPE=gem2s npm run paramsHashToParams');
  }
};

run()