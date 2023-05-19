const Hapi = require('@hapi/hapi');
const Joi = require('joi');
const Boom = require('@hapi/boom');
const path = require('path');
const knex = require('knex')(require('../knexfile').development);
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

    server.views({
        engines: { html: require('handlebars') },
        layout: true,
        relativeTo: __dirname,
        path: 'templates',
        layoutPath: 'templates/layout',
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
        method: 'POST',
        path: '/hacktoberfest',
        handler: require('./handlers/hacktoberfest/register'),
        options: {
            validate: {
                payload: Joi.object({
                    github_user: joi_validators.github_user.required(),
                    email: Joi.string().email().required(),
                    accept_terms: Joi.string().valid('on').required(),
                    accept_us_transfers: Joi.string().valid('on').required(),
                    language: Joi.string().valid('de', 'en').required(),
                    year: Joi.string().valid('2020', '2021').required(),
                }),
                failAction: async (request, h, err) => {
                    const redirect_domain = request.payload.language === 'de' ? 'datenanfragen.de' : 'datarequests.org';
                    return h
                        .redirect(`https://www.${redirect_domain}/blog/hacktoberfest-2020#!error=validation`)
                        .takeover();
                },
            },
        },
    });
    server.route({
        method: 'GET',
        path: '/hacktoberfest/address/{github_user}/{token}',
        handler: require('./handlers/hacktoberfest/submit-address').submitAddressForm,
        options: {
            validate: {
                params: Joi.object({
                    github_user: joi_validators.github_user.required(),
                    token: joi_validators.nanoid.required(),
                }),
            },
        },
    });
    server.route({
        method: 'POST',
        path: '/hacktoberfest/address',
        handler: require('./handlers/hacktoberfest/submit-address').submitAddress,
        options: {
            validate: {
                payload: Joi.object({
                    // prettier-ignore
                    size: Joi.string()
                        .valid('unisex-xs', 'unisex-s', 'unisex-m', 'unisex-l', 'unisex-xl', 'unisex-2xl', 'unisex-3xl', 'unisex-4xl', 'unisex-5xl', 'tapered-xs', 'tapered-s', 'tapered-m', 'tapered-l', 'tapered-xl', 'tapered-2xl', 'tapered-3xl'),

                    name: joi_validators.post_string.max(30).required(),
                    additional1: joi_validators.post_string.max(40).allow(''),
                    additional2: joi_validators.post_string.max(40).allow(''),
                    street: joi_validators.post_string.max(40).required(),
                    zip: joi_validators.post_string.max(20).required(),
                    city: joi_validators.post_string.max(30).required(),
                    additional3: joi_validators.post_string.max(20).allow(''),
                    country: joi_validators.alpha2_country.required(),

                    phone: Joi.string()
                        .pattern(/^[0-9 +]+$/)
                        .max(15)
                        .allow(''),
                    email: Joi.string().email().max(50).allow(''),

                    github_user: joi_validators.github_user.required(),
                    token: joi_validators.nanoid.required(),
                    language: Joi.string().valid('de', 'en').required(),
                }),
            },
        },
    });
    server.route({
        method: 'GET',
        path: '/hacktoberfest/address/{language}/success',
        handler: require('./handlers/hacktoberfest/submit-address').confirmation,
        options: {
            validate: {
                params: Joi.object({
                    language: Joi.string().valid('de', 'en').required(),
                }),
            },
        },
    });
    server.route({
        method: 'GET',
        path: '/hacktoberfest/send/{github_user}/{token}/{admin_token}',
        handler: require('./handlers/hacktoberfest/submit-address').markSent,
        options: {
            validate: {
                params: Joi.object({
                    github_user: joi_validators.github_user.required(),
                    token: joi_validators.nanoid.required(),
                    admin_token: joi_validators.nanoid.required(),
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
