exports.up = function (knex) {
    return knex.schema.createTable('hacktoberfest', function (t) {
        t.string('github_user').primary();
        t.string('email').notNullable();
        t.boolean('accept_terms').notNullable();
        t.boolean('accept_us_transfers').notNullable();
        t.string('year').notNullable();
        t.string('language').notNullable();
        t.datetime('added_at').notNullable();

        t.unique(['email']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('hacktoberfest');
};
