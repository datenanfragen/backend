/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.dropTableIfExists('hacktoberfest');
};

exports.down = function () {
    console.error("Migration: 'Remove Hacktoberfest': Won't restore table. Just run every migration up to this point.");
};
