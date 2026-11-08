const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { init } = require('../src/server');

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
        assert.strictEqual(res.statusCode, 200);
        assert(res.result.includes('You have reached one of the servers running in the background'));
    });
});
