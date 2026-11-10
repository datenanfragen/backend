import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { init } from '../src/server.ts';
import Hapi from '@hapi/hapi';

process.on('unhandledRejection', (err) => {
    console.error('An unhandled promise rejection occurred:', err);
    process.exit(1);
});

describe('Basic Tests', (t) => {
    let server: Hapi.Server<Hapi.ServerApplicationState>;
    beforeEach(async () => {
        server = await init();
    });
    afterEach(async () => {
        await server.stop();
    });

    test('GET /', async () => {
        const res = await server.inject({
            method: 'get',
            url: '/',
        });
        assert.equal(res.statusCode, 200);
        assert.ok(res.result);

        assert(res.result.includes('You have reached one of the servers running in the background'));
    });

    test('post a comment', async () => {
        const target = 'test-' + crypto.randomUUID();

        // 1. No comment present.
        const start_get = await server.inject({ method: 'GET', url: '/comments/get/' + target });

        assert.equal(start_get.statusCode, 200);
        assert(Array.isArray(start_get.result) && start_get.result.length === 0);

        const start_atom = await server.inject({ method: 'GET', url: '/comments/feed/' + target });

        assert.equal(start_atom.statusCode, 200);
        assert.equal(
            start_atom.result,
            `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>${target}</title>
    <updated>1970-01-01T00:00:00.000Z</updated>
    <id>datenanfragenDE:${target}:comments</id>
    <generator uri="https://github.com/datenanfragen/backend">Datenanfragen.de backend</generator>


</feed>
`,
        );

        // 2. Add a comment

        // 3. Retrieve that comment
    });
});
