module.exports = {
    development: {
        migrations: { tableName: 'knex_migrations' },
        useNullAsDefault: true,

        client: 'sqlite3',
        connection: {
            filename: './database.sqlite',
        },
    },
};
