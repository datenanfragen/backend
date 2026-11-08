/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.dropTableIfExists('mollie_ids');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    // copied from `20200813004058_mollie_ids.js`
    return knex.schema.createTable('mollie_ids', function (t) {
        t.string('reference').primary();
        t.string('mollie_id').notNullable();
    });
};
