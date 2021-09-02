exports.up = function(knex) {
  return knex.schema.createTable('experiment_runs', (table) => {
    table.string('experiment_id').notNullable()
    table.string('pipeline_type').notNullable()
    table.string('params_hash')
    table.string('state_machine_arn')
    table.string('extension_arn')

    table.primary(['experiment_id', 'pipeline_type'])
  })
};

exports.down = function(knex) {
  return knex.schema.dropTable('experiment_runs');
};
