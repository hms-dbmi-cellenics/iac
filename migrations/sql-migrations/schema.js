const knex = require('knex')({
  client: 'postgresql',
  connection: {
    host : '127.0.0.1',
    port : 5432,
    user : 'dev_role',
    password : '',
    database : 'aurora_db'
  },
  migrations: {
    tableName: 'migrations'
  }
});


const pipelineTypeEnum = knex.raw(`CREATE TYPE pipeline_type AS ENUM ('qc', 'gem2s');`);
const sampleTechnologyEnum = knex.raw(`CREATE TYPE sample_technology AS ENUM ('10x, 'rhapsody');`);
const sampleFileTypeEnum = knex.raw(`CREATE TYPE sample_file_type AS ENUM ('features10x', 'barcodes10x', 'matrix10x', 'rhapsody');`);
const uploadStatusEnum = knex.raw(
  `CREATE TYPE upload_status AS ENUM (
    'uploaded', 'uploading', 'compressing', 'uploadError', 'fileNotFound', 'fileReadError', 'fileReadAborted'
  );`
);

const experiment = knex.schema
  .createTable('experiment', table => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.jsonb('processing_config').notNullable();
    table.boolean('notify_by_email').notNullable();
    // Based on https://stackoverflow.com/a/46106302
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('update_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  }
);

const experimentExecution = knex.schema
  .createTable('experiment_execution', table => {
    table.uuid('experiment_id').references('experiment.id');
    table.enu('pipeline_type', null, { useNative: true, existingType: true, enumName: 'pipeline_type' });
    table.string('params_hash').notNullable();
    table.string('state_machine_arn').notNullable();
    table.string('execution_arn').notNullable();

    table.primary(['experiment_id', 'pipeline_type']);
  }
);

const sample = knex.schema
  .createTable('sample', table => {
    table.uuid('id').primary();
    table.uuid('experiment_id').references('experiment.id');;
    table.string('name');
    table.enu('sample_technology', null, { useNative: true, existingType: true, enumName: 'sample_technology' });
    // Based on https://stackoverflow.com/a/46106302
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('update_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });

const sampleFile = knex.schema
  .createTable('sample_file', table => {
    table.uuid('id').primary();
    table.enu('sample_file_type', null, { useNative: true, existingType: true, enumName: 'sample_file_type' });
    table.boolean('valid');
    table.string('s3_path');
    table.enu('upload_status', null, { useNative: true, existingType: true, enumName: 'upload_status' });
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
  });
  
const sampleToSampleFileMap = knex.schema
  .createTable('sample_to_sample_file_map', table => {
    table.uuid('sample_id');
    table.uuid('experiment_id').references('experiment.id');;
    
    table.primary(['sample_id', 'experiment_id']);
  });
  
const metadataTrack = knex.schema
  .createTable('metadata_track', table => {
    table.string('key');
    table.uuid('experiment_id').references('experiment.id');;

    table.primary(['key', 'experiment_id'])
  });
  
const sampleInMetadataTrackMap = knex.schema
  .createTable('sample_in_metadata_track_map', table => {
    table.string('metadata_track_key').references('metadata_track.key');
    table.uuid('sample_id').references('sample.id');
    table.string('value');

    table.primary(['metadata_track_key', 'sample_id']);
  });
  
const plot = knex.schema
  .createTable('plot', table => {
    table.uuid('id');
    table.uuid('experiment_id').references('experiment.id');;
    table.jsonb('config');
    table.string('plot_s3_data_key');
    
    table.primary(['id', 'experiment_id']);
  });

Promise.all([
  pipelineTypeEnum, 
  sampleTechnologyEnum, 
  sampleFileTypeEnum, 
  uploadStatusEnum,
  experiment, 
  experimentExecution,
  sample, 
  sampleFile, 
  metadataTrack, 
  plot,
  sampleToSampleFileMap, 
  sampleInMetadataTrackMap
]).then((whatHappened) => {
  console.log('whatHappenedDebug');
  console.log(whatHappened);
});