exports.up = function (knex) {
    return knex.schema.createTable('comments', function (t) {
        t.string('id').primary();
        t.string('author').notNullable();
        t.text('message').notNullable();
        t.text('target').notNullable();
        t.json('additional');
        t.string('accept_token').notNullable();
        t.boolean('is_accepted').notNullable();
        t.datetime('added_at').notNullable();
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('comments');
};
