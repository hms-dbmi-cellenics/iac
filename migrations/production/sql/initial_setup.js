exports.up = function(knex) {
  return knex.schema
    .createTable('invite-access', function (table) {
       table.increments('id');
       table.string('user_email', 255)
       .notNullable();
       table.uuid('experimentId')
       .notNullable()
       .references('experiment.id');
       table.string('role', 36)
       .notNullable()
       table.timestamp('updatedAt')
       .defaultTo(knex.fn.now())
       .notNullable();
    })
    .createTable('experiment', function (table) {
       table.uuid('id').primary();
    });
};

exports.down = function(knex) {
  return knex.schema
      .dropTable("invite-access")
      .dropTable("experiment");
};
