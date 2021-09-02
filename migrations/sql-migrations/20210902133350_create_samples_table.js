exports.up = function(knex) {
  return knex.schema.createTable('samples', (table) => {
    table.uuid('sample_uuid').notNullable()
    table.uuid('project_uuid').notNullable()
    table.text('name').notNullable()
    table.text('species')
    table.text('type').notNullable()
    table.boolean('complete').notNullable().defaultTo(true) // TODO not sure if required
    table.boolean('error').notNullable().defaultTo(false) // TODO not sure if required
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

    table.primary(['sample_uuid'])

  })
};

exports.down = function(knex) {
  knex.schema.dropTable('samples')
};
