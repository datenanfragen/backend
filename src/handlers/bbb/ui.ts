import type { HapiHandler } from '../../util/types.ts';
import config from '../../../config.json' with { type: 'json' };
import { bbb } from '../../util/bbb.ts';

export const adminUi: HapiHandler = async (request, h) => {
    const admin_token = request.state.bbb_admin_token;
    if (admin_token !== config.bbb.admin_token) return h.view('bbb-admin-login.html');

    const meetings = await request.server.methods.knex('bbb').select();
    const api_meetings = await bbb('getMeetings');

    return h.view('bbb-admin-ui.html', {
        title: 'BBB admin UI',
        api_meetings,
        meetings,

        create_success: !!request.query.create_success,
        create_error: request.query.create_error,
        delete_success: !!request.query.delete_success,
        delete_error: request.query.delete_error,
    });
};
