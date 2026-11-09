import knex from 'knex';
import type { Plugin } from '@hapi/hapi';
// @ts-expect-error The Knex CLI uses Liftoff, which isn't aware of Node's native TS support yet. Using TS for the
// knexfile without installing one of the supported handlers works but produces annoying error messages on each CLI run.
import knexConfig from '../../knexfile.js';

declare module '@hapi/hapi' {
    interface ServerMethods {
        knex: typeof Knex;
    }
}

const Knex = knex(knexConfig.development);

const knexPlugin: Plugin<null> = {
    name: 'knex',
    register: function (server) {
        server.method('knex', Knex);
    },
};

export default knexPlugin;
