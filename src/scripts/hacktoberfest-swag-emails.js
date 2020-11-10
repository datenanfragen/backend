const knex = require('knex')(require('../../knexfile').development);
const config = require('../../config.json');
const { partition } = require('../util/functions');
const { transporter } = require('../util/email');

const I18N = {
    de: {
        completed_subject: 'Deine Preise bei der Datenanfragen.de-Hacktoberfest-Aktion',
        // prettier-ignore
        completed_body: (user) => `Hallo ${user.github_user},

Du hast erfolgreich bei der Hacktoberfest-Aktion des Datenanfragen.de e. V. teilgenommen${
            user.gets_tshirt
                ? '. Deine Pull Requests haben uns besonders gut gefallen, von daher bekommst Du neben dem Sticker-Set auch ein T-Shirt von uns'
                : ' und bekommst daher ein Sticker-Set von uns geschenkt'
        }.

Damit wir Dir Deine Preise zuschicken können, brauchen wir Deine Adresse${user.gets_tshirt ? ' und T-Shirt-Größe' : ''}.
Gib diese bitte auf dieser Seite an: https://backend.datenanfragen.de/hacktoberfest/address/${user.github_user}/${user.token}

Diese Daten heben wir natürlich nur so lange wie nötig auf. Sobald wir Deine Preise verschickt haben, löschen wir diese Daten umgehend wieder. Das kannst Du auch noch einmal in den Teilnahme- und Datenschutzbedingungen für diese Aktion (https://static.dacdn.de/docs/bedingungen-hacktoberfest-${user.year}.pdf), denen Du bei der Anmeldung zugestimmt hast, nachlesen.
Bitte gib Deine Adresse bis spätestens Ende Dezember an, da wir im neuen Jahr alle Hacktoberfest-Daten löschen und danach keine Preise mehr verschicken können.

Vielen Dank für Deine Teilnahme. Wir würden uns freuen, Dich auch in Zukunft bei uns begrüßen zu dürfen.
Solltest Du noch Fragen haben, wende Dich gerne über hacktoberfest@datenanfragen.de an uns.

Happy Hacking!
Dein Team vom Datenanfragen.de e. V.`,
        failed_subject: 'Deine Teilnahme bei der Datenanfragen.de-Hacktoberfest-Aktion',
        failed_body: (user) => `Hallo ${user.github_user},

Du hattest Dich für die Hacktoberfest-Aktion des Datenanfragen.de e. V. angemeldet. Diese ist nun vorbei.

Wir haben keine Pull-Requests von Dir gefunden, von daher bekommst Du leider auch keine Preise.
Haben wir etwas übersehen? Dann sag uns bitte vor Ende des Monats Bescheid – danach werden wir Deine Daten nämlich automatisch löschen.

Trotzdem vielen Dank für Dein Interesse. Solltest Du noch Lust haben, etwas zum Projekt beizutragen, schau doch einmal auf dieser Seite vorbei:
https://www.datenanfragen.de/mitmachen/

Solltest Du noch Fragen haben, wende Dich gerne über hacktoberfest@datenanfragen.de an uns.

Happy Hacking!
Dein Team vom Datenanfragen.de e. V.`,
    },
    en: {
        completed_subject: 'Your prizes from the datarequests.org Hacktoberfest event',
        // prettier-ignore
        completed_body: (user) => `Hi ${user.github_user},

you have successfully participated in the Hacktoberfest event by datarequests.org${
            user.gets_tshirt
                ? '. We really liked your pull requests and will thus send you both a sticker set and a tshirt'
                : '  and now your sticker set is waiting for you'
        }.

In order to ship your prizes to you, we need your address${user.gets_tshirt ? ' and tshirt size' : ''}.
Please submit them through this page: https://backend.datenanfragen.de/hacktoberfest/address/${user.github_user}/${user.token}

Of course, we will only keep this data as long as necessary. Once we have sent your prizes, we will promptly delete the address data. For reference, see the conditions of participation and privacy policy for this event (https://static.dacdn.de/docs/conditions-hacktoberfest-${user.year}.pdf), which you have agreed to when registering.
Please submit your address no later than by the end of December, as we delete all Hacktoberfest data in the new year and won't be able to send out any prizes afterwards.

Thanks for participating. We hope you contribute again soon.
If you have any questions, please email hacktoberfest@datenanfragen.de.

Happy hacking!
Your datarequests.org team`,
        failed_subject: 'Your registration for the datarequests.org Hacktoberfest event',
        failed_body: (user) => `Hi ${user.github_user},

you had registered for the datarequests.org Hacktoberfest event. This event is now over.

We didn't find any pull requests submitted by you. Thus, you will unfortunately not get any prizes.
Did we miss something? Please tell us before the end of the month—afterwards, we will automatically delete your data.

Thank you very much for your interest. If you still feel like contributing, have a look at this page:
https://www.datarequests.org/contribute

If you have any questions, please email hacktoberfest@datenanfragen.de.

Happy hacking!
Your datarequests.org team`,
    },
};

async function main() {
    const date = new Date();
    const year = date.getFullYear();
    if (date.toISOString() < `${year}-11-05`) {
        console.error('Email sending can only occur after the registration deadline has passed');
        process.exit(1);
    }

    const users = await knex('hacktoberfest').select().where({ result_email_sent: null });
    const [completed_users, failed_users] = partition(
        users,
        (u) =>
            u.completed_challenge_override === 1 ||
            (u.completed_challenge === 1 && !(u.completed_challenge_override === 0))
    );

    async function sendEmail(github_user, recipient_email, subject, body) {
        await transporter.sendMail({
            from: config.hacktoberfest.sender,
            to: recipient_email,
            subject: subject,
            text: body,
            replyTo: config.hacktoberfest.reply_to_email,
            headers: { 'X-Easter-Egg': 'TODO' },
        });

        await knex('hacktoberfest').where({ github_user }).update({ result_email_sent: new Date().toISOString() });
    }

    for (const u of completed_users) {
        console.log(`Sending "completed" email to ${u.github_user}…`);
        await sendEmail(u.github_user, u.email, I18N[u.language].completed_subject, I18N[u.language].completed_body(u));
    }
    for (const u of failed_users) {
        console.log(`Sending "failed" email to ${u.github_user}…`);
        await sendEmail(u.github_user, u.email, I18N[u.language].failed_subject, I18N[u.language].failed_body(u));
    }

    console.log('Done');
}

main();
