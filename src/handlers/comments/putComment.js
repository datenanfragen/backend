const { nanoid } = require('nanoid');
const nodemailer = require('nodemailer');
const config = require('../../../config.json');

async function putComment(request, h) {
    const service_url =
        config.comments.service_url || `${request.headers['X-Forwarded-Proto']}://${request.headers['Host']}/comments`;

    const item = {
        id: nanoid(),
        author: request.payload.author ? stripTags(request.payload.author) : 'Anonymous',
        message: request.payload.message,
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
            message:
                'Successfully added comment. It will need to be accepted by an administrator before it is published.',
        }))
        .catch((e) => {
            console.error(e);
            return h.response({ message: 'Error while storing the comment.' }).code(500);
        });
}

async function sendTokenMail(comment, service_url) {
    const transporter = nodemailer.createTransport({
        host: config.comments.smtp_host,
        port: config.comments.smtp_port,
        secure: !!config.comments.smtp_secure,
        auth: {
            user: config.comments.smtp_user,
            pass: config.comments.smtp_password,
        },
    });
    const mailOptions = {
        from: config.comments.token_sender,
        to: config.comments.token_recipients,
        subject: 'New comment received for Datenanfragen.de"',
        text: `A new comment has been submitted.

ID: "${comment.id}"
Author: "${comment.author}"
Target post: "${comment.target}"
Additional data: "${comment.additional}"

Comment:
"${comment.message}"

Use the following link to accept the comment:
${service_url}/token/${comment.id}/${comment.accept_token}

If you don't want to accept the comment, you don't need to do anything.`,
    };

    return transporter.sendMail(mailOptions);
}

function stripTags(str) {
    return str.replace(/<[^>]+>/gi, '');
}

module.exports = putComment;
