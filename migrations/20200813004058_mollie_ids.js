exports.up = function (knex) {
    return knex.schema.createTable('mollie_ids', function (t) {
        t.string('reference').primary();
        t.string('mollie_id').notNullable();
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('mollie_ids');
};
