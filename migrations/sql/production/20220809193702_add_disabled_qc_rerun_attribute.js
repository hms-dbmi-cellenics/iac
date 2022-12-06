/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
 exports.up = async (knex) => {
    await knex.schema.alterTable('experiment', (table) => {
      table.integer('pipeline_version').notNullable().defaultTo(1);
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = async (knex) => {
    await knex.schema.alterTable('experiment', (table) => {
      table.dropColumn('pipeline_version');
    });
  };