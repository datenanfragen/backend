const config = require('../../../config.json');
const { generateReference, stripTags } = require('../../util/functions');
const { transporter } = require('../../util/email');

async function reportMisconduct(request, h) {
    const now = new Date();
    const reference = generateReference(now);
    const text = stripTags(request.payload.encryptedMessage);

    return await transporter
        .sendMail({
            from: config.conduct.sender,
            to: config.conduct.recipients,
            subject: `Datenanfragen.de CoC report submitted (${reference}, ${now.toISOString()})`,
            text,
        })
        .then(() => ({
            message: 'Report sent successfully.',
        }))
        .catch((e) => {
            console.error(e);
            return h.response({ message: 'Error while sending report.' }).code(500);
        });
}

module.exports = reportMisconduct;
