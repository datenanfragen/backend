const Hapi = require('@hapi/hapi');
const Joi = require('joi');
const Boom = require('@hapi/boom');
const path = require('path');
const knex = require('knex').knex(require('../knexfile').development);
const joi_validators = require('./util/joi');
const joi = require('./util/joi');

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
    // For template rendering support.
    await server.register(require('@hapi/vision'));
    // Expose the database to the routes.
    server.method('knex', knex);

    // Configure the cookie for administering BBB.
    server.state('bbb_admin_token', {
        ttl: 1000 * 60 * 60 * 24 * 365,
        isSecure: true,
        isHttpOnly: false,
        encoding: 'none',
        clearInvalid: false,
        strictHeader: true,
    });

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

    const view_manager = server.views({
        engines: { html: require('handlebars') },
        layout: true,
        relativeTo: __dirname,
        path: 'templates',
        layoutPath: 'templates/layout',
    });
    view_manager.registerHelper('jsonify', (obj) => JSON.stringify(obj, null, 2));

    server.route({
        method: 'PUT',
        path: '/comments',
        handler: require('./handlers/comments/putComment'),
        options: {
            validate: {
                payload: Joi.object({
                    author: Joi.string().max(75).allow(''),
                    message: Joi.string().max(10000).required(),
                    target: Joi.string().max(150).required(),
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
                    target: Joi.string(),
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
                        'relevant-countries': Joi.array().items(Joi.string().allow(null)).default(['all']),
                        name: Joi.string(),
                        web: Joi.string().uri({
                            scheme: [/https?/],
                        }),
                        sources: Joi.array().items(Joi.string()).default([]),
                        address: Joi.string(),
                    })
                        .required()
                        .unknown()
                        .or('name', 'web'),
                    comment: Joi.string().max(10000).allow(''),
                }),
                failAction: async (request, h, err) => {
                    if (
                        (err.details[0].type === 'object.missing' &&
                            err.details[0].context.peersWithLabels.includes('name')) ||
                        err.details[0].context.key === 'slug'
                    ) {
                        const error = Boom.badRequest(
                            `NameOrWebMissing: You need to provide either a name or web attribute.`
                        );
                        error.output.payload.path = err.details[0].path;
                        throw error;
                    } else {
                        console.error('ValidationError:', err.message);
                        const error = err.details[0].path.includes('data')
                            ? Boom.badRequest(`Invalid database entry.`)
                            : Boom.badRequest(`Invalid request payload input`);
                        if (err.details[0].path[0] === 'data') {
                            error.output.payload.path = err.details[0].path;
                        }
                        throw error;
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
        method: ['GET', 'POST'],
        path: '/hacktoberfest/{anything?}',
        handler: (_, h) => {
            return h.response().code(410); // 410 - gone
        },
    });

    server.route({
        method: 'GET',
        path: '/meet/admin',
        handler: require('./handlers/bbb/ui').adminUi,
    });
    server.route({
        method: 'POST',
        path: '/meet/admin/create',
        handler: require('./handlers/bbb/api').createRoom,
        options: {
            validate: {
                payload: Joi.object({
                    room_name: Joi.string().max(150).required(),
                    slug: Joi.string()
                        .pattern(/^[a-z0-9-_]+$/i)
                        .max(50)
                        .required(),
                    welcome_message: Joi.string(),
                    additional_params: Joi.string()
                        .custom((val) => {
                            new URLSearchParams(val);
                            return val;
                        }, 'URLSearchParams validation')
                        .allow(''),
                    admin_only: joi_validators.html_checkbox,
                    anonymous_users_can_start: joi_validators.html_checkbox,
                    anonymous_users_join_as_guest: joi_validators.html_checkbox,
                }),
            },
        },
    });
    server.route({
        method: 'GET',
        path: '/meet/join/{lang}/{slug}',
        handler: require('./handlers/bbb/api').joinRoom,
        options: {
            validate: {
                params: Joi.object({
                    lang: Joi.string().valid('de', 'en').required(),
                    slug: Joi.string().required(),
                }),
                query: Joi.object({
                    name: Joi.string().max(50).allow(''),
                }),
            },
        },
    });
    server.route({
        method: 'POST',
        path: '/meet/admin/delete',
        handler: require('./handlers/bbb/api').deleteRoom,
        options: {
            validate: {
                payload: Joi.object({
                    slug: Joi.string().required(),
                }),
            },
        },
    });

    server.route({
        method: 'POST',
        path: '/report-misconduct',
        handler: require('./handlers/conduct/report-misconduct'),
        options: {
            validate: {
                payload: Joi.object({
                    encryptedMessage: Joi.string()
                        .pattern(/^\s*-----BEGIN PGP MESSAGE-----/)
                        .pattern(/-----END PGP MESSAGE-----\s*$/)
                        .max(10000000)
                        .required(),
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
        path: '/{param*}',
        handler: {
            directory: {
                path: '.',
                redirectToSlash: true,
                index: true,
            },
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
