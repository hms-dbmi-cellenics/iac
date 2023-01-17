const _ = require('lodash');
const knexfileLoader = require('../knexfile');
const knex = require('knex');
const chalk = require('chalk');
const { atomic } = require('atomic');

const fs = require('fs');
const { exit } = require('process');

const CELL_SETS_DIR = '2023-01-17-migrate-params-hash-to-last-gem2s-params/cellSets';

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

let includesCellIds = (subarray, container) => subarray.some(v => container.includes(v));

const getValueForSample = (experimentId, trackKey, trackCellSets, sampleData) => {
  const { cellIds: sampleCellIds } = sampleData;

  const samplesValue = trackCellSets.filter(({ cellIds: valueCellIds }) => {
    return includesCellIds(sampleCellIds, valueCellIds);
  });

  if (samplesValue.length > 1) {
    console.error(
      chalk.red(
        `
    ---------------------[ERROR]---------------------
      experiment: ${experimentId}, 
      sample: ${sampleData.key}
      metadataTrack: ${trackKey}
      
      More than one metadata value has cellIds from the sample
    -------------------------------------------------
`
      )
    );
    throw new Error('More than one metadata value has cellIds from the sample');
  }

  return samplesValue[0].key;
}

const getMetadata = async (experimentId, sortedSamplesData, metadataTracks) => {
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

  return metadata;
}

const getLatestGem2sRunParams = async (experimentId, currentGem2sParams) => {
  const cellSets = await readCellSets(`${CELL_SETS_DIR}/${experimentId}`);

  const samplesData = _.find(cellSets, { key: 'sample' }).children;
  const sortedSamplesData = _.sortBy(samplesData, ['key']);

  // Any cell class of type metadataCategorical (and not sample) is a metadata
  const metadataTracks = cellSets.filter(({ type, key }) => type === 'metadataCategorical' && key !== 'sample');

  return {
    sampleTechnology: undefined,
    sampleIds: _.map(sortedSamplesData, 'key'),
    sampleNames: _.map(sortedSamplesData, 'name'),
    // TODO: Should we look at sampleOptions? It might be harder to see whether this is checked, and honestly it's not used that much as far as I know
    // Current implementation isn't looking at sampleOptions)
    sampleOptions: currentGem2sParams.sampleOptions,
    metadata: await getMetadata(experimentId, sortedSamplesData, metadataTracks),
  };
};

const getCurrentGem2sParams = async (experimentId, knex) => {
  const samples = await getSamples(experimentId, knex);

  const samplesObj = samples.reduce(
    (acc, current) => {
      acc[current.id] = current;
      return acc;
    },
    {},
  );

  const { sampleTechnology, metadata } = samples[0];

  const sampleIds = Object.keys(samplesObj).sort();
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


const startMigration = async (sqlClient) => {
  const gem2sExecutions = await sqlClient.select().from(tableNames.EXPERIMENT_EXECUTION).where({ pipeline_type: 'gem2s' });

  // const sliceSize = gem2sExecutions.length;
  const sliceSize = 100;

  const missingExps = new Set(_.range(1, sliceSize + 1));

  await Promise.all(
    gem2sExecutions
      .slice(0, sliceSize)
      .map(async (execution, index) => {
        try {
          const { experiment_id: experimentId } = execution;

          const currentGem2sParams = await getCurrentGem2sParams(experimentId, sqlClient);
          const latestGem2sRunParams = await getLatestGem2sRunParams(experimentId, currentGem2sParams);

          if (!_.isEqual(currentGem2sParams, latestGem2sRunParams)) {
            console.log(chalk.yellow('-----experimentIdDebug'));
            console.log(experimentId);

            console.log(chalk.yellow('-----currentGem2sParamsDebug'));
            console.log(currentGem2sParams);

            console.log(chalk.yellow('-----latestGem2sRunParamsDebug'));
            console.log(latestGem2sRunParams);

            console.log(chalk.yellow('Are they equal?'));
            console.log(_.isEqual(currentGem2sParams, latestGem2sRunParams));

            console.log(chalk.yellow('------------------------------------------'));
          }

          missingExps.delete(index);
          console.log(`Experiments missing: ${missingExps.size}`);

          // await sqlClient(tableNames.EXPERIMENT_EXECUTION)
          //   .update({ last_gem2s_params: currentGem2sParams })
          //   .where({
          //     pipeline_type: 'gem2s',
          //     experiment_id: experimentId,
          //   });

        } catch (e) {
          console.log(chalk.red('Error: '));
          console.log(e);
        }
      }),
  );
}


const createSqlClient = async (activeEnvironment, sandboxId) => {
  const knexfile = await knexfileLoader(activeEnvironment, sandboxId);
  return knex.default(knexfile[activeEnvironment]);
}

const run = async () => {
  const environment = process.env.TARGET_ENV;
  const sandboxId = process.env.SANDBOX_ID;

  if (!_.isNil(environment) && !_.isNil(sandboxId)) {
    sqlClient = await createSqlClient(environment, sandboxId);

    console.log('Created SQL client');

    await startMigration(sqlClient);

    console.log('>>>>--------------------------------------------------------->>>>');
    console.log('                     Finished');
    console.log('>>>>--------------------------------------------------------->>>>');

    exit();
  } else {
    console.log('You need to specify what environment to run this on.');
    console.log('e.g.: TARGET_ENV=staging npm run dynamoToSql');
  }
};

run()