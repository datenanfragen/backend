const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const path = require('path');
const knex = require('knex')(require('../knexfile').development);

const init = async () => {
    const server = Hapi.server({
        port: 3000,
        host: '0.0.0.0',
        routes: {
            cors: true,
            files: {
                relativeTo: path.join(__dirname, 'static'),
            },
            validate: {
                // taken from: https://github.com/hapijs/hapi/issues/3706#issuecomment-349765943
                failAction: async (request, h, err) => {
                    if (process.env.NODE_ENV === 'production') {
                        console.error('ValidationError:', err.message);
                        throw Boom.badRequest(`Invalid request payload input`);
                    } else {
                        console.error(err);
                        throw err;
                    }
                },
            },
        },
    });
    // For serving static files.
    await server.register(require('@hapi/inert'));
    // Expose the database to the routes.
    server.method('knex', knex);

    await server.register({
        plugin: require('hapi-cron'),
        options: {
            jobs: [
                {
                    name: 'garbage_collect',
                    time: '0 0 0 * * *',
                    timezone: 'Europe/Berlin',
                    request: {
                        method: 'POST',
                        url: '/cron/garbageCollect',
                    },
                    onComplete: (res) => {
                        console.log('cron:', res.message);
                    },
                },
            ],
        },
    });

    server.route({
        method: 'PUT',
        path: '/comments',
        handler: require('./handlers/comments/putComment'),
        options: {
            validate: {
                payload: Joi.object({
                    author: Joi.string().allow(''),
                    message: Joi.string().required(),
                    target: Joi.string().required(),
                    additional: Joi.object(),
                }),
            },
        },
    });
    server.route({
        method: 'GET',
        path: '/comments/accept/{id}/{token}',
        handler: require('./handlers/comments/acceptComment'),
    });
    server.route({
        method: 'GET',
        path: '/comments/{action}/{target*}',
        handler: require('./handlers/comments/getComments'),
        options: {
            validate: {
                params: Joi.object({
                    action: Joi.string().valid('get', 'feed').required(),
                    target: Joi.string().required(),
                }),
            },
        },
    });

    server.route({
        method: 'PUT',
        path: '/suggest',
        handler: require('./handlers/suggest/handler'),
        options: {
            validate: {
                payload: Joi.object({
                    for: Joi.string().required().valid('cdb'),
                    new: Joi.boolean().required(),
                    data: Joi.object({
                        slug: Joi.string().required(),
                        'relevant-countries': Joi.array().items(Joi.string()).default(['all']),
                        name: Joi.string(),
                        web: Joi.string().domain(),
                        sources: Joi.array().items(Joi.string()).default([]),
                        address: Joi.string(),
                    })
                        .required()
                        .unknown()
                        .or('name', 'web'),
                }),
                failAction: async (request, h, err) => {
                    if (
                        err.details[0].type === 'object.missing' &&
                        err.details[0].context.peersWithLabels.includes('name')
                    ) {
                        throw Boom.badRequest(`NameOrWebMissing: You need to provide either a name or web attribute.`, {
                            translation_string: 'name-or-web-missing',
                        });
                    } else if (process.env.NODE_ENV === 'production') {
                        console.error('ValidationError:', err.message);
                        throw err.details[0].context.key === 'data'
                            ? Boom.badRequest(`Invalid database entry.`, {
                                  translation_string: 'invalid-database-entry',
                              })
                            : Boom.badRequest(`Invalid request payload input`);
                    } else {
                        console.error(err);
                        throw err;
                    }
                },
            },
        },
    });

    server.route({
        method: 'POST',
        path: '/donation',
        handler: require('./handlers/donation/post'),
        options: {
            validate: {
                payload: Joi.object({
                    method: Joi.string().valid('mollie', 'creditcard', 'cryptocurrency').required(),
                    amount: Joi.string()
                        .pattern(/^[0-9]+\.[0-9]{2}$/)
                        .required(),
                    description: Joi.string(),
                    reference: Joi.string().required(),
                    redirect_base: Joi.string()
                        .required()
                        .pattern(/^https:\/\/.+/),
                }),
            },
        },
    });

    server.route({
        method: 'GET',
        path: '/donation/state/{reference*}',
        handler: require('./handlers/donation/state'),
        options: {
            validate: {
                params: Joi.object({
                    reference: Joi.string().required(),
                }),
            },
        },
    });

    server.route({
        method: 'POST',
        path: '/cron/garbageCollect',
        handler: require('./handlers/cron/garbageCollect'),
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
    console.error('An unhandled promise rejection occurred:', err);
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
