const { nanoid } = require('nanoid');
const nodemailer = require('nodemailer');
const config = require('../../../config.json');
const { stripTags } = require('../../util/functions');

const successMessage =
    'Successfully added comment. It will need to be accepted by an administrator before it is published.';

async function putComment(request, h) {
    // Silently drop ridiculously short comments, which are pretty much guaranteed to be spam.
    if (request.payload.message?.length < 5) return { message: successMessage };

    const service_url =
        config.comments.service_url || `${request.headers['X-Forwarded-Proto']}://${request.headers['Host']}/comments`;

    const item = {
        id: nanoid(),
        author: request.payload.author ? stripTags(request.payload.author).trim() : 'Anonymous',
        message: request.payload.message.trim(),
        target: request.payload.target.replace(/[^a-zA-Z0-9/_-]/, '').replace(/^\s*\/*\s*|\s*\/*\s*$/gm, ''),
        additional: request.payload.additional instanceof Object ? JSON.stringify(request.payload.additional) : '{}',
        accept_token: nanoid(),
        is_accepted: false,
        added_at: new Date().toISOString(),
    };

    return await request.server.methods
        .knex('comments')
        .insert(item)
        .then(() => sendTokenMail(item, service_url))
        .then(() => ({
            message: successMessage,
        }))
        .catch((e) => {
            console.error(e);
            return h.response({ message: 'Error while storing the comment.' }).code(500);
        });
}

async function sendTokenMail(comment, service_url) {
    // TODO: Migrate to import from `util/mail.js`.
    const transporter = nodemailer.createTransport({
        host: config.email.smtp_host,
        port: config.email.smtp_port,
        secure: !!config.email.smtp_secure,
        auth: {
            user: config.email.smtp_user,
            pass: config.email.smtp_password,
        },
    });
    const mailOptions = {
        from: config.comments.token_sender,
        to: config.comments.token_recipients,
        subject: 'New comment received for Datenanfragen.de',
        text: `A new comment has been submitted.

ID: "${comment.id}"
Author: "${comment.author}"
Target post: "${comment.target}"
Additional data: "${comment.additional}"

Comment:
"${comment.message}"

Use the following link to accept the comment:
${service_url}/accept/${comment.id}/${comment.accept_token}

If you don't want to accept the comment, you don't need to do anything.`,
    };

    return transporter.sendMail(mailOptions);
}

module.exports = putComment;
