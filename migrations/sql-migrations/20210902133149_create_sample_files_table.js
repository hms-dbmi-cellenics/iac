exports.up = function(knex) {
  return knex.schema.createTable('sample_files', (table) => {
    table.uuid('sample_uuid').notNullable()
    table.string('file_type').notNullable()
    table.string('s3_path').notNullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

    table.primary(['sample_uuid', 'file_type'])
  })
};

exports.down = function(knex) {
  knex.schema.dropTable('sample_files')
};
