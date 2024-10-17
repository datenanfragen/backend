/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('bbb', function (t) {
        t.string('slug').primary();
        t.string('params').notNullable();
        t.boolean('admin_only').notNullable().defaultTo(false);
        t.boolean('anonymous_users_can_start').notNullable().defaultTo(false);
        t.boolean('anonymous_users_join_as_guest').notNullable().defaultTo(false);
        t.datetime('added_at').notNullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('bbb');
};
