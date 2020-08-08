const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const path = require('path');
const knex = require('knex')(require('../knexfile').development);

const init = async () => {
    const server = Hapi.server({
        port: 3000,
        host: 'localhost',
        routes: {
            files: {
                relativeTo: path.join(__dirname, 'static'),
            },
        },
    });
    // For serving static files.
    await server.register(require('@hapi/inert'));
    // Expose the database to the routes.
    server.method('knex', knex);

    server.route({
        method: 'PUT',
        path: '/comments',
        handler: require('./handlers/comments/putComment'),
        options: {
            cors: true,
            validate: {
                payload: Joi.object({
                    author: Joi.string(),
                    message: Joi.string().required(),
                    target: Joi.string().required(),
                    additional: Joi.object(),
                }),
            },
        },
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
            return h.file('index.html');
        },
    });

    await server.start();
    console.log('Server running on', server.info.uri);
};

process.on('unhandledRejection', (err) => {
    console.err('An unhandled promise rejection occurred:', err);
    // PM2 will auto-restart in this case.
    // TODO: We should probably be informed about this somehow.
    process.exit(1);
});

try {
    require('../config.json');
} catch (_) {
    console.error(
        'Invalid or missing configuration. Please copy `config-sample.json` to `config.json` and change the values as needed.'
    );
    process.exit(1);
}

init();
