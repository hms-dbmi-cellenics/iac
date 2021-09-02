exports.up = function(knex) {
  return knex.schema.createTable('experiments', (table) => {
    table.string('experiment_id').notNullable()
    table.string('project_uuid').notNullable()
    table.string('name').notNullable()
    table.text('description')
    table.string('organism')
    table.enum('type', ['10x']).defaultTo('10x')
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    table.jsonb('processing_config').notNullable()

    table.primary(['experiment_id'])
  })
};

exports.down = function(knex) {
  knex.schema.dropTable('experiments')
};
