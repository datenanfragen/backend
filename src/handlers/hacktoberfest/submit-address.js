const { nanoid } = require('nanoid');
const config = require('../../../config.json');
const { transporter } = require('../../util/email');

const I18N = {
    de: {
        form_title: 'Adresse für Datenanfragen.de-Hacktoberfest-Preise angeben',
        invalid_token: 'Ungültige Kombination aus GitHub-Nutzer_in und Token.',
        address_known:
            'Du hast Deine Adresse bereits angegeben und brauchst das nicht noch einmal zu tun. Noch Fragen? Dann wende Dich bitte an hacktoberfest@datenanfragen.de.',
        error_submitting:
            'Leider ist beim Absenden ein Fehler aufgetreten. Bitte schick uns eine E-Mail an hacktoberfest@datenanfragen.de.',
        confirmation_email_subject: 'Danke für das Angeben Deiner Adresse beim Datenanfragen.de-Hacktoberfest',
        confirmation_email_body: (github_user, address, tshirt_size) => `Hallo ${github_user},

danke, dass Du Deine Adresse für die Hacktoberfest-Aktion des Datenanfragen.de e. V. angegeben hast. Wir werden Deine Preise bald verschicken und die Adressdaten anschließend umgehend wieder löschen.
Aufgrund des internationalen Versands kann es aber noch etwas dauern, bis die Sendung bei Dir eintrifft.

Hier findest Du noch einmal die Daten, die wir erhalten haben. Falls etwas falsch sein sollte, gib uns bitte Bescheid.

Adresse:
${Object.values(address)
    .filter((l) => l && l.trim() !== '')
    .join('\n')}
${tshirt_size ? `\nT-Shirt-Größe: ${tshirt_size}\n` : ''}
Vielen Dank für Deine Teilnahme. Wir würden uns freuen, Dich auch in Zukunft bei uns begrüßen zu dürfen.
Solltest Du noch Fragen haben, wende Dich gerne über hacktoberfest@datenanfragen.de an uns.

Happy Hacking!
Dein Team vom Datenanfragen.de e. V.`,
        success_message:
            'Vielen Dank. Du hast Deine Daten erfolgreich angegeben. Du solltest gleich eine Bestätigungs-E-Mail erhalten.',
    },
    en: {
        form_title: 'Submit address for datarequests.org Hacktoberfest event',
        invalid_token: 'Invalid GitHub user/token combination.',
        address_known:
            "You have already submitted your address and don't need to do so again. Questions? Please email hacktoberfest@datenanfragen.de.",
        error_submitting:
            'Unfortunately, an error occurred while submitting. Please email hacktoberfest@datenanfragen.de.',
        confirmation_email_subject: 'Thanks for submitting your address for the datarequests.org Hacktoberfest event',
        confirmation_email_body: (github_user, address, tshirt_size) => `Hi ${github_user},

thanks for submitting your address for the datarequests.org Hacktoberfest event. We will soon ship your prizes and then prompty delete your address data.
Please note that it may take some time for the prizes to arrive as we are shipping internationally.

Below, you can see the details we received. If anything's wrong, please email us.

Address:
${Object.values(address)
    .filter((l) => l && l.trim() !== '')
    .join('\n')}
${tshirt_size ? `\nTshirt size: ${tshirt_size}\n` : ''}
Thanks for participating. We hope you contribute again soon.
If you have any questions, please email hacktoberfest@datenanfragen.de.

Happy hacking!
Your datarequests.org team`,
        success_message:
            'Thanks, the data has been submitted successfully. You should receive a confirmation email soon.',
    },
};

async function submitAddressForm(request, h) {
    const user = await request.server.methods
        .knex('hacktoberfest')
        .select()
        .where({ github_user: request.params.github_user, token: request.params.token })
        .first();
    if (!user) return h.view('render-text', { text: 'Invalid user/token.' }).code(401);
    const lang = user.language;
    if (user.confirmation_email_sent || user.swag_sent)
        return h.view('render-text', { text: I18N[lang].address_known });

    return h.view(`hacktoberfest-address-form.${lang}.html`, { title: I18N[lang].form_title, user });
}

async function submitAddress(request, h) {
    const { github_user, token, language, size } = request.payload;
    const { name, additional1, additional2, street, zip, city, additional3, country, phone, email } = request.payload;
    const address = { name, additional1, additional2, street, zip, city, additional3, country, phone, email };

    const service_url = `${request.headers['origin']}/hacktoberfest`;
    const knex_user = () =>
        request.server.methods
            .knex('hacktoberfest')
            .where({ github_user: github_user, token: token, confirmation_email_sent: null, swag_sent: null });

    return knex_user()
        .update({
            tshirt_size: size,
            address: JSON.stringify(address),
            admin_token: nanoid(),
        })
        .then((count) => {
            if (count < 1) throw new Error('invalid_token');
        })
        .then(() => knex_user().select().first())
        .then((row) => sendEmails(row, language, github_user, address, size, service_url))
        .then(() => knex_user().update({ confirmation_email_sent: new Date().toISOString() }))
        .then(() => h.redirect(`/hacktoberfest/address/${language}/success`))
        .catch((e) => {
            if (e.message === 'invalid_token') {
                return h.view('render-text', { text: I18N[language].invalid_token }).code(401);
            }

            console.error(e);
            return h.view('render-text', { text: I18N[language].error_submitting }).code(500);
        });
}

async function confirmation(request, h) {
    return h.view('render-text', { text: I18N[request.params.language].success_message });
}

async function markSent(request, h) {
    const { github_user, token, admin_token } = request.params;
    return await request.server.methods
        .knex('hacktoberfest')
        .where({ github_user: github_user, token: token, admin_token: admin_token, swag_sent: null })
        .update({
            swag_sent: new Date().toISOString(),
        })
        .then((count) => {
            if (count < 1) throw new Error('invalid_token');
        })
        .then(() => h.view('render-text', { text: `Successfully marked swag for ${github_user} as sent.` }))
        .catch((e) => {
            if (e.message === 'invalid_token') return h.view('render-text', { text: 'Invalid user/token.' }).code(401);

            console.error(e.message);
            return h.view('render-text', { text: 'Error marking swag as sent.' }).code(500);
        });
}

async function sendEmails(row, language, github_user, address, tshirt_size, service_url) {
    await transporter.sendMail({
        from: config.hacktoberfest.sender,
        to: 'benni@datenanfragen.de',
        subject: `Hacktoberfest address for ${github_user}`,
        text: `The following address was submitted for Hacktoberfest:

GitHub user: ${github_user}

Address:
${JSON.stringify(address, null, 4)}

Gets tshirt? ${!!row.gets_tshirt}
Tshirt size: ${tshirt_size}

DB entry:
${JSON.stringify(row, null, 4)}

Mark as sent: ${service_url}/send/${github_user}/${row.token}/${row.admin_token}
Delete this email immediately afterwards.`,
    });

    return transporter.sendMail({
        from: config.hacktoberfest.sender,
        to: row.email,
        subject: I18N[language].confirmation_email_subject,
        text: I18N[language].confirmation_email_body(github_user, address, tshirt_size),
        replyTo: config.hacktoberfest.reply_to_email,
        headers: { 'X-Easter-Egg': '4qCZ4qCf4qC64qCy4qC64qCU4qC64qCb4qCt4qCJ4qCf' },
    });
}

module.exports = { submitAddressForm, submitAddress, confirmation, markSent };
