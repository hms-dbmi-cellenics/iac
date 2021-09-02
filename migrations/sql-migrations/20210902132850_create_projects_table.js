exports.up = function(knex) {
  return knex.schema.createTable('projects', (table) => {
    table.uuid('project_uuid').notNullable()
    table.string('name').notNullable()
    table.text('description').notNullable()
    table.timestamp('last_analyzed_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

    table.primary(['project_uuid'])
  })
};

exports.down = function(knex) {
  knex.schema.dropTable('projects')
};
