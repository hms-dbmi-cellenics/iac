exports.up = function(knex) {
  return knex.schema.createTable('experiment_permissions', (table) => {
    table.increments()
    table.uuid('project_uuid').notNullable()
    table.string('cognito_user_id').notNullable()
    table.string('type').notNullable()
  })
};

exports.down = function(knex) {
  knex.schema.dropTable('experiment_permissions')
};
