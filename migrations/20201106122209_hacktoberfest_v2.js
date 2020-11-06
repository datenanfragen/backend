exports.up = function (knex) {
    return knex.schema.table('hacktoberfest', function (t) {
        t.text('token').notNullable().defaultTo('invalid');
        t.text('pr_urls');
        t.bool('completed_challenge').defaultTo(false);
        // This is a tristate value. `null` means no override (i.e. use the value of `completed_challenge`).
        t.bool('completed_challenge_override').defaultTo(null);
        t.bool('gets_tshirt');
        t.text('address');
        t.bool('sent').notNullable().defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.table('hacktoberfest', function (t) {
        t.dropColumn('pr_urls');
        t.dropColumn('completed_challenge');
        t.dropColumn('completed_challenge_override');
        t.dropColumn('gets_tshirt');
        t.dropColumn('address');
        t.dropColumn('sent');
        t.dropColumn('token');
    });
};
