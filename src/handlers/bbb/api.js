const config = require('../../../config.json').bbb;
const bbb = require('../../util/bbb').bbb;

async function createRoom(request, h) {
    const admin_token = request.state.bbb_admin_token;
    if (admin_token !== config.admin_token) return h.redirect('/meet/admin');

    const {
        room_name,
        slug,
        welcome_message,
        additional_params,
        admin_only,
        anonymous_users_can_start,
        anonymous_users_join_as_guest,
    } = request.payload;

    const params = new URLSearchParams(additional_params);
    params.set('name', room_name);
    params.set('meetingID', slug);
    params.set('welcome', welcome_message);

    return await request.server.methods
        .knex('bbb')
        .insert({
            slug,
            params: params.toString(),
            admin_only,
            anonymous_users_can_start,
            anonymous_users_join_as_guest,
            added_at: new Date().toISOString(),
        })
        .then(() => h.redirect('/meet/admin?create_success=1'))
        .catch(async (e) => {
            console.error('Error while creating room:', e);
            return h.redirect(`/meet/admin?create_error=${encodeURIComponent(e.code + ' :: ' + e.message)}`);
        });
}

const join_translations = {
    de: {
        not_found: 'Der gewünschte Raum existiert nicht.',
        server_error:
            'Beim Beitreten ist leider ein unerwarter Serverfehler aufgetreten. Bitte versuche es später erneut.',
        admin_only: 'Du darfst diesem Raum nicht beitreten.',
    },
    en: {
        not_found: 'The requested room does not exist.',
        server_error:
            'Unfortunately, an unexpected error occurred while trying to join the requested room. Please try again later.',
        admin_only: 'You cannot join this room.',
    },
};
async function joinRoom(request, h) {
    const is_admin = request.state.bbb_admin_token === config.admin_token;

    const { lang, slug } = request.params;

    const meeting = await request.server.methods.knex('bbb').select().where({ slug }).first();
    if (!meeting) return h.view('render-text', { text: join_translations[lang].not_found }).code(404);

    if (!is_admin && meeting.admin_only)
        return h.view('render-text', { text: join_translations[lang].admin_only }).code(404);

    const params = new URLSearchParams(meeting.params);

    const name = request.query.name;
    if (!name) return h.view(`bbb-enter-name.${lang}.html`, { room_name: params.get('name') });

    const is_meeting_running = await bbb('isMeetingRunning', { meetingID: slug }).then((r) => r.running);

    if (!is_meeting_running && !is_admin && !meeting.anonymous_users_can_start)
        return h.view(`bbb-wait-for-start.${lang}.html`, { room_name: params.get('name') }).header('refresh', '60');

    const bbb_meeting = await bbb('getMeetingInfo', { meetingID: slug })
        .catch(() => bbb('create', meeting.params))
        .catch((err) => {
            console.error('Failed to create BBB meeting:', err);
            return h.view('render-text', { text: join_translations[lang].server_error }).code(500);
        });

    const join_url = await bbb('join', {
        fullName: name,
        meetingID: bbb_meeting.meetingID,
        // This is quite silly. These passwords actually serve no security purpose. Knowing them gets you nothing since
        // you need to know the API key to generate the checksum ("signature").
        //
        // The BBB devs appear to have realized this as well since according to the API docs
        // (https://docs.bigbluebutton.org/development/api/#get-join), the `password` parameter is deprecated when
        // joining and you're instead just supposed to use `role=MODERATOR` or `role=VIEWER`. However, for some reason
        // this doesn't appear to actually work (might be caused by Senfcall's proxy?).
        //
        // But, since we need to fetch the meeting details from the API anyway, I'm not "emulating" the `role` parameter
        // by hardcoding the passwords.
        password: is_admin ? bbb_meeting.moderatorPW : bbb_meeting.attendeePW,
        createTime: bbb_meeting.createTime,
        ...(meeting.anonymous_users_join_as_guest && { guest: true }),
    });
    return h.redirect(join_url);
}

async function deleteRoom(request, h) {
    const admin_token = request.state.bbb_admin_token;
    if (admin_token !== config.admin_token) return h.redirect('/meet/admin');

    const slug = request.payload.slug;

    // I would have preferred to be considerate here and also end the meeting in the BBB API, but Senfcall doesn't let
    // me (`Error: Not Implemented`). *shrug*

    return await request.server.methods
        .knex('bbb')
        .where({ slug })
        .del()
        .then(() => h.redirect('/meet/admin?delete_success=1'))
        .catch(async (e) => {
            console.error(`Error while deleting room "${slug}":`, e);
            return h.redirect(`/meet/admin?delete_error=${encodeURIComponent(e.code + ' :: ' + e.message)}`);
        });
}

module.exports = { createRoom, joinRoom, deleteRoom };
