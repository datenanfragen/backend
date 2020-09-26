const nodemailer = require('nodemailer');
const config = require('../../../config.json');

const I18N = {
    de: {
        subject: () => 'Deine Anmeldung bei der Datenanfragen.de-Hacktoberfest-Aktion',
        text: (github_user, year) => `Hallo ${github_user},

danke, dass Du Dich zur Hacktoberfest ${year}-Aktion des Datenanfragen.de e. V. angemeldet hast. Hiermit bestätigen wir Dir Deine Registrierung.

Wenn Du zwischen dem 01. Oktober ${year} und dem 01. November ${year} mindestens eine Pull-Request in einem der qualifizierten Repositories einreicht, die von uns angenommen wird, bekommst Du von uns ein Sticker-Set geschenkt und hast die Chance auf eines von 10 T-Shirts, die wir für die besten Beiträge verlosen.
Die genauen Details findest Du in unserem Blog (https://www.datenanfragen.de/blog/hacktoberfest-${year}/). Bitte beachte auch die Teilnahme- und Datenschutzbedingungen (https://static.dacdn.de/docs/bedingungen-hacktoberfest-${year}.pdf), denen Du zugestimmt hast.

Wir freuen uns auf Deine Beiträge. Solltest Du noch Fragen haben, wende Dich gerne über hacktoberfest@datenanfragen.de an uns.

Happy Hacking!
Dein Team vom Datenanfragen.de e. V.`,
    },
    en: {
        subject: () => 'Your registration for the datarequests.org Hacktoberfest event',
        text: (github_user, year) => `Hi ${github_user},

thanks for registering for the Hacktoberfest ${year} event by datarequests.org. We are sending you this email to confirm your registration.

If you submit at least one pull request that we accept between October 1, ${year} and November 1, ${year}, we will send you a free sticker set and you will have a chance to win one of 10 t-shirts that we are awarding to the best contributions.
For the details, please have a look at our blog (https://www.datarequests.org/blog/hacktoberfest-${year}/). Please also take note of the conditions of participation and privacy policy (https://static.dacdn.de/docs/conditions-hacktoberfest-${year}.pdf) that you agreed to.

We are looking forward to your contributions. If you have any questions, feel free to contact us via our hacktoberfest@datenanfragen.de email.

Happy hacking!
Your datarequests.org team`,
    },
};

async function register(request, h) {
    const redirect_base = `https://www.${request.payload.language === 'de' ? 'datenanfragen.de' : 'datarequests.org'}`;

    const date = new Date();
    if (
        date.getFullYear() !== parseInt(request.payload.year) ||
        date.toISOString() < `${request.payload.year}-09-27` ||
        date.toISOString() > `${request.payload.year}-11-05`
    ) {
        return h.redirect(`${redirect_base}/blog/hacktoberfest-${request.payload.year}#!error=expired`);
    }

    if (request.payload.github_user.startsWith('@')) {
        request.payload.github_user = request.payload.github_user.replace('@', '');
    }

    const item = {
        github_user: request.payload.github_user,
        email: request.payload.email,
        // This is a little stupid since this code can only be reached if this is true. However, I feel like we are
        // better fulfilling our burden of proving that the user actually accepted by doing it this way instead of
        // always saving `true`. In the latter case, we might as well just not include this column at all. :D
        accept_terms: request.payload.accept_terms === 'on',
        accept_us_transfers: request.payload.accept_us_transfers === 'on',
        language: request.payload.language,
        year: request.payload.year,
        added_at: new Date().toISOString(),
    };

    return await request.server.methods
        .knex('hacktoberfest')
        .insert(item)
        .then(() => sendConfirmationMail(item.github_user, item.email, item.language, item.year))
        .then(() => {
            return h.redirect(`${redirect_base}/blog/hacktoberfest-${item.year}#!success=1`);
        })
        .catch(async (e) => {
            if (e.code === 'SQLITE_CONSTRAINT') {
                return h.redirect(`${redirect_base}/blog/hacktoberfest-${item.year}#!error=duplicate`);
            }

            console.error(e);
            await request.server.methods.knex('hacktoberfest').where('github_user', '=', item.github_user).del();
            return h.redirect(`${redirect_base}/blog/hacktoberfest-${item.year}#!error=server`);
        });
}

async function sendConfirmationMail(github_user, email, language, year) {
    const transporter = nodemailer.createTransport({
        host: config.email.smtp_host,
        port: config.email.smtp_port,
        secure: !!config.email.smtp_secure,
        auth: {
            user: config.email.smtp_user,
            pass: config.email.smtp_password,
        },
    });

    return transporter.sendMail({
        from: config.hacktoberfest.sender,
        to: email,
        subject: I18N[language].subject(),
        text: I18N[language].text(github_user, year),
        replyTo: config.hacktoberfest.reply_to_email,
        headers: {
            'X-Easter-Egg':
                'Companies would probably tell you to apply for a job here but you already want to contribute anyway... So, just know that we appreciate you! <3',
        },
    });
}

module.exports = register;
