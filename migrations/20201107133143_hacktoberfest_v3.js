exports.up = async function (knex) {
    await knex.schema.table('hacktoberfest', function (t) {
        t.dropColumn('sent');
        t.dropColumn('address');
    });
    return knex.schema.table('hacktoberfest', function (t) {
        t.json('address');
        t.datetime('result_email_sent').defaultTo(null);
        t.datetime('confirmation_email_sent').defaultTo(null);
        t.text('admin_token').notNullable().defaultTo('invalid');
        t.datetime('swag_sent').defaultTo(null);
        t.text('tshirt_size').defaultTo(null);
    });
};

exports.down = async function (knex) {
    await knex.schema.table('hacktoberfest', function (t) {
        t.dropColumn('swag_sent');
        t.dropColumn('result_email_sent');
        t.dropColumn('confirmation_email_sent');
        t.dropColumn('admin_token');
        t.dropColumn('tshirt_size');
        t.dropColumn('address');
        t.bool('sent').notNullable().defaultTo(false);
    });
    return knex.schema.table('hacktoberfest', function (t) {
        t.text('address');
    });
};
