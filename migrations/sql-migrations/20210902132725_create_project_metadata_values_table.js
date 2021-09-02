exports.up = function(knex) {
  return knex.schema.createTable('project_metadata_values', (table) => {
    table.uuid('metadata_uuid').notNullable()
    table.uuid('sample_uuid').notNullable()
    table.string('value').notNullable()

    table.primary(['metadata_uuid', 'sample_uuid'])
  })
};

exports.down = function(knex) {
  knex.schema.dropTable('project_metadata_values')
};
