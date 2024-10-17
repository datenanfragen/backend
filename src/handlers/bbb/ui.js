const config = require('../../../config.json').bbb;
const bbb = require('../../util/bbb').bbb;

async function adminUi(request, h) {
    const admin_token = request.state.bbb_admin_token;
    if (admin_token !== config.admin_token) return h.view('bbb-admin-login.html');

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
}

module.exports = { adminUi };
