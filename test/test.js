import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert, { strictEqual } from 'node:assert/strict';
import { init } from '../src/server.ts';

describe('Basic Tests', (t) => {
    let server;
    beforeEach(async () => {
        server = await init();
    });
    afterEach(async () => {
        server.stop();
    });

    test('GET /', async () => {
        const res = await server.inject({
            method: 'get',
            url: '/',
        });
        strictEqual(res.statusCode, 200);
        assert(res.result.includes('You have reached one of the servers running in the background'));
    });
});
