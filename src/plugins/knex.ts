import knex from 'knex';
import type { Plugin } from '@hapi/hapi';
// @ts-expect-error The Knex CLI uses Liftoff, which isn't aware of Node's native TS support yet. Using TS for the
// knexfile without installing one of the supported handlers works but produces annoying error messages on each CLI run.
import knexConfig from '../../knexfile.js';

declare module '@hapi/hapi' {
    interface ServerMethods {
        knex: ReturnType<typeof makeKnex>;
    }
}

const makeKnex = () => knex(knexConfig.development);

const knexPlugin: Plugin<null> = {
    name: 'knex',
    register: function (server) {
        server.method('knex', makeKnex());

        server.ext({
            type: 'onPostStop',
            method: (s) => s.methods.knex.destroy(),
        });
    },
};

export default knexPlugin;
