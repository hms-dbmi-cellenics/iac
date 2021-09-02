exports.up = function(knex) {
  return knex.schema.createTable('project_metadata', (table) => {
    table.uuid('metadata_uuid').notNullable()
    table.uuid('project_uuid').notNullable()
    table.string('name').notNullable()

    table.primary(['metadata_uuid'])
  })
};

exports.down = function(knex) {
  knex.schema.dropTable('project_metadata')
};
