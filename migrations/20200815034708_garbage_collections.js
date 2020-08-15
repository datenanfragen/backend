exports.up = function (knex) {
    return knex.schema.table('mollie_ids', function (t) {
        // Unfortunately, SQLITE doesn't allow variable defaults on ALTER ADD, so we need to set the old data to a specific fixed date.
        t.datetime('added_at').notNullable().defaultTo(new Date().toISOString());
    });
};

exports.down = function (knex) {
    return knex.schema.table('mollie_ids', function (t) {
        t.dropColumn('added_at');
    });
};
