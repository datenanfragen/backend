import Hapi from '@hapi/hapi';
import Joi, { type ValidationError } from 'joi';
import Boom from '@hapi/boom';
import { join } from 'node:path';
import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import Knex from './plugins/knex.ts';
// @ts-expect-error hapi-cron has no type definitions.
import Cron from 'hapi-cron';
import { html_checkbox } from './util/joi.ts';
import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';
import { createRoom, deleteRoom, joinRoom } from './handlers/bbb/api.ts';
import { adminUi } from './handlers/bbb/ui.ts';
import { acceptComment } from './handlers/comments/acceptComment.ts';
import { getComments } from './handlers/comments/getComments.ts';
import { putComment } from './handlers/comments/putComment.ts';
import { reportMisconduct } from './handlers/conduct/report-misconduct.ts';
import { garbageCollect } from './handlers/cron/garbageCollect.ts';
import { suggest } from './handlers/suggest/suggest.ts';

const server = Hapi.server({
    port: 3000,
    host: '0.0.0.0',
    routes: {
        cors: true,
        files: {
            relativeTo: join(import.meta.dirname, 'static'),
        },
        validate: {
            // taken from: https://github.com/hapijs/hapi/issues/3706#issuecomment-349765943
            failAction: async (request, h, err) => {
                if (process.env.NODE_ENV === 'production') {
                    console.error('ValidationError:', err?.message);
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
await server.register(Inert);
// For template rendering support.
await server.register(Vision);
// Expose the database to the routes.
await server.register(Knex);

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
    plugin: Cron,
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
                onComplete: (res: { message: string }) => {
                    console.log('cron:', res.message);
                },
            },
        ],
    },
});

const view_manager = server.views({
    engines: { html: Handlebars },
    layout: true,
    relativeTo: import.meta.dirname,
    path: 'templates',
    layoutPath: 'templates/layout',
});
view_manager.registerHelper('jsonify', (obj) => JSON.stringify(obj, null, 2));

server.route({
    method: 'PUT',
    path: '/comments',
    handler: putComment,
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
    handler: acceptComment,
});
server.route({
    method: 'GET',
    path: '/comments/{action}/{target*}',
    handler: getComments,
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
    handler: suggest,
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
            failAction: async (request, h, _err) => {
                if (!_err) throw new Error('No err in failAction. This should never happen.');

                const err = _err as ValidationError;

                if (
                    (err.details[0].type === 'object.missing' &&
                        err.details[0].context?.peersWithLabels.includes('name')) ||
                    err.details[0].context?.key === 'slug'
                ) {
                    const error = Boom.badRequest(
                        `NameOrWebMissing: You need to provide either a name or web attribute.`,
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
    handler: (_, h) => {
        return h.response().code(410); // 410 - gone
    },
});

server.route({
    method: 'GET',
    path: '/donation/state/{reference*}',
    handler: (_, h) => {
        return h.response().code(410); // 410 - gone
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
    handler: (_, h) => h.response().code(503),
    // handler: adminUi,
});
server.route({
    method: 'POST',
    path: '/meet/admin/create',
    handler: (_, h) => h.response().code(503),
    // handler: createRoom,
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
                admin_only: html_checkbox,
                anonymous_users_can_start: html_checkbox,
                anonymous_users_join_as_guest: html_checkbox,
            }),
        },
    },
});
server.route({
    method: 'GET',
    path: '/meet/join/{lang}/{slug}',
    handler: (_, h) => h.response().code(503),
    // handler: joinRoom,
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
    handler: (_, h) => h.response().code(503),
    // handler: deleteRoom,
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
    handler: reportMisconduct,
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
    handler: garbageCollect,
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

export const init = async () => {
    await server.initialize();
    return server;
};

export const start = async () => {
    await server.start();
    console.log('Server running on', server.info.uri);
    return server;
};

try {
    JSON.parse(await readFile(join(import.meta.dirname, '../config.json'), 'utf-8'));
} catch {
    console.error(
        'Invalid or missing configuration. Please copy `config-sample.json` to `config.json` and change the values as needed.',
    );
    process.exit(1);
}

process.on('unhandledRejection', (err) => {
    console.error('An unhandled promise rejection occurred:', err);
    // PM2 will auto-restart in this case.
    // TODO: We should probably be informed about this somehow.
    process.exit(1);
});
