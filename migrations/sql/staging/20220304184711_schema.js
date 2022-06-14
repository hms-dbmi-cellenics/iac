const deleteSampleFileIfOrphanFunc = `
CREATE OR REPLACE FUNCTION public.delete_sample_file_if_orphan()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM sample_file
  WHERE 
    sample_file.id = OLD.sample_file_id AND
    NOT EXISTS(
      SELECT FROM sample_to_sample_file_map sf_map 
      WHERE sf_map.sample_file_id = OLD.sample_file_id AND NOT OLD.sample_id = sf_map.sample_id
    );
  RETURN OLD;
END;
$function$
`;

const setUpdatedAtTimestampTrigger = (table) => (`
CREATE TRIGGER ${table}_updated_at_trigger
BEFORE UPDATE ON ${table}
FOR EACH ROW
EXECUTE PROCEDURE on_update_timestamp();
`);

// If the sample file that was deleted has no other
//  references in sample_to_sample_file_map, delete it
const setDeleteSampleFileIfOrphanTrigger = `
CREATE TRIGGER delete_sample_file_if_orphan_trigger
AFTER DELETE ON sample_to_sample_file_map
FOR EACH ROW EXECUTE FUNCTION delete_sample_file_if_orphan();
`;

const nativeEnum = (table, tableName) => (
  table.enu(tableName, null, { useNative: true, existingType: true, enumName: tableName })
);


const setupEnums = async (knex) => {
  await knex.raw('CREATE TYPE pipeline_type AS ENUM (\'qc\', \'gem2s\');');
  await knex.raw('CREATE TYPE sample_technology AS ENUM (\'10x\', \'rhapsody\');');
  await knex.raw('CREATE TYPE sample_file_type AS ENUM (\'features10x\', \'barcodes10x\', \'matrix10x\', \'rhapsody\');');
  await knex.raw(
    'CREATE TYPE upload_status AS ENUM (\'uploaded\', \'uploading\', \'compressing\', \'uploadError\', \'fileNotFound\', \'fileReadError\', \'fileReadAborted\');',
  );
  await knex.raw('CREATE TYPE access_role AS ENUM (\'owner\', \'admin\', \'explorer\', \'viewer\');');
};

const setupFunctions = async (knex) => {
  await knex.raw(deleteSampleFileIfOrphanFunc);
};

/**
* @param { import("knex").Knex } knex
* @returns { Promise<void> }
*/
exports.up = async (knex) => {
  await setupEnums(knex);
  await setupFunctions(knex);

  await knex.schema
    .createTable('experiment', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.text('description').notNullable();
      table.jsonb('processing_config').defaultTo(JSON.stringify({}));
      table.boolean('notify_by_email').defaultTo(true);
      table.jsonb('samples_order').defaultTo(JSON.stringify([]));
      // Based on https://stackoverflow.com/a/48028011
      table.timestamps(true, true);
    }).then(() => {
      knex.raw(setUpdatedAtTimestampTrigger('experiment'));
    });

  await knex.schema
    .createTable('experiment_execution', (table) => {
      table.string('experiment_id').references('experiment.id').onDelete('CASCADE');
      nativeEnum(table, 'pipeline_type').notNullable();
      table.string('params_hash').nullable();
      table.string('state_machine_arn').notNullable();
      table.string('execution_arn').notNullable();
      table.jsonb('last_status_response').nullable().defaultTo(null);

      table.primary(['experiment_id', 'pipeline_type']);
    });

  await knex.schema
    .createTable('sample', (table) => {
      table.uuid('id').primary();
      table.string('experiment_id').notNullable().references('experiment.id').onDelete('CASCADE');
      table.string('name').notNullable();
      nativeEnum(table, 'sample_technology').notNullable();
      table.timestamps(true, true);
    }).then(() => {
      knex.raw(setUpdatedAtTimestampTrigger('sample'));
    });

  await knex.schema
    .createTable('sample_file', (table) => {
      table.uuid('id').primary();
      nativeEnum(table, 'sample_file_type').notNullable();
      table.integer('size').notNullable();
      table.string('s3_path').notNullable();
      nativeEnum(table, 'upload_status').notNullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    }).then(() => {
      knex.raw(setUpdatedAtTimestampTrigger('sample_file'));
    });

  await knex.schema
    .createTable('metadata_track', (table) => {
      table.increments('id', { primaryKey: true });
      table.string('experiment_id').references('experiment.id').onDelete('CASCADE').notNullable();
      table.string('key');

      table.unique(['experiment_id', 'key']);
    });

  await knex.schema
    .createTable('sample_to_sample_file_map', (table) => {
      table.uuid('sample_id').references('sample.id').onDelete('CASCADE').notNullable();
      table.uuid('sample_file_id').references('sample_file.id').onDelete('CASCADE').notNullable();

      table.primary(['sample_id', 'sample_file_id']);
    }).then(async () => {
      await knex.raw(setDeleteSampleFileIfOrphanTrigger);
    });

  await knex.schema
    .createTable('sample_in_metadata_track_map', (table) => {
      table.integer('metadata_track_id').references('metadata_track.id').onDelete('CASCADE').notNullable();
      table.uuid('sample_id').references('sample.id').onDelete('CASCADE').notNullable();
      table.string('value').defaultTo('N.A.');

      table.primary(['metadata_track_id', 'sample_id']);
    });

  await knex.schema
    .createTable('plot', (table) => {
      table.string('id').notNullable();
      table.string('experiment_id').references('experiment.id').onDelete('CASCADE').notNullable();
      table.jsonb('config').defaultTo(JSON.stringify({}));
      table.string('s3_data_key').nullable();

      table.primary(['id', 'experiment_id']);
    });

  await knex.schema
    .createTable('invite_access', (table) => {
      table.string('user_email', 255).notNullable();
      table.string('experiment_id').notNullable().references('experiment.id');
      nativeEnum(table, 'access_role').notNullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.primary(['user_email', 'experiment_id']);
    }).then(() => {
      knex.raw(setUpdatedAtTimestampTrigger('invite_access'));
    });

  await knex.schema
    .createTable('user_access', (table) => {
      table.uuid('user_id').notNullable();
      table.string('experiment_id').references('experiment.id').onDelete('CASCADE');
      nativeEnum(table, 'access_role').notNullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.primary(['user_id', 'experiment_id']);
    }).then(() => {
      knex.raw(setUpdatedAtTimestampTrigger('user_access'));
    });
};

/**
* @param { import("knex").Knex } knex
* @returns { Promise<void> }
*/
exports.down = async (knex) => {
  await Promise.all([
    knex.schema.dropTable('user_access'),
    knex.schema.dropTable('invite_access'),
    knex.schema.dropTable('plot'),
    knex.schema.dropTable('sample_to_sample_file_map'),
    knex.schema.dropTable('sample_in_metadata_track_map'),
    knex.schema.dropTable('metadata_track'),
    knex.schema.dropTable('sample_file'),
    knex.schema.dropTable('sample'),
    knex.schema.dropTable('experiment_execution'),
    knex.schema.dropTable('experiment'),

    knex.schema.raw('DROP TYPE access_role;'),
    knex.schema.raw('DROP TYPE upload_status;'),
    knex.schema.raw('DROP TYPE sample_file_type;'),
    knex.schema.raw('DROP TYPE sample_technology;'),
    knex.schema.raw('DROP TYPE pipeline_type;'),
  ]);
};
