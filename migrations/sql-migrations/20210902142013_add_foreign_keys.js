exports.up = function(knex) {
  return knex.schema.alterTable('experiment_permissions', (table) => {
    table.foreign('project_uuid').references('projects.project_uuid')
      .onDelete('cascade').onUpdate('cascade')
  })

  .alterTable('experiment_runs', (table) => {
    table.foreign('experiment_id').references('experiments.experiment_id')
      .onDelete('cascade').onUpdate('cascade')
  })

  .alterTable('experiments', (table) => {
    table.foreign('project_uuid').references('projects.project_uuid')
      .onDelete('cascade').onUpdate('cascade')
  })

  .alterTable('project_metadata', (table) => {
    table.foreign('project_uuid').references('projects.project_uuid')
      .onDelete('cascade').onUpdate('cascade')
  })

  .alterTable('project_metadata_values', (table) => {
    table.foreign('sample_uuid').references('samples.sample_uuid')
      .onDelete('cascade').onUpdate('cascade')
    table.foreign('metadata_uuid').references('project_metadata.metadata_uuid')
      .onDelete('cascade').onUpdate('cascade')
  })

  .alterTable('sample_files', (table) => {
    table.foreign('sample_uuid').references('samples.sample_uuid')
      .onDelete('cascade').onUpdate('cascade')
  })

  .alterTable('samples', (table) => {
    table.foreign('project_uuid').references('projects.project_uuid')
      .onDelete('cascade').onUpdate('cascade')
  })
};

exports.down = function(knex) {

};
