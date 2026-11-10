import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import config from '../../../config.json' with { type: 'json' };
import { stripTags } from '../../util/functions.ts';
import type { HapiHandler } from '../../util/types.ts';

const successMessage =
    'Successfully added comment. It will need to be accepted by an administrator before it is published.';

export const putComment: HapiHandler = async (request, h) => {
    const { message, author, target } = request.payload as { message: string; author: string; target: string };

    // Silently drop ridiculously short comments, which are pretty much guaranteed to be spam.
    if (message?.length < 5) return { message: successMessage };

    const service_url =
        config.comments.service_url || `${request.headers['X-Forwarded-Proto']}://${request.headers['Host']}/comments`;

    const item = {
        id: nanoid(),
        author: author ? stripTags(author).trim() : 'Anonymous',
        message: message.trim(),
        target: target.replace(/[^a-zA-Z0-9/_-]/, '').replace(/^\s*\/*\s*|\s*\/*\s*$/gm, ''),
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
};

async function sendTokenMail(
    comment: { id: string; author: string; target: string; message: string; accept_token: string },
    service_url: string,
) {
    // TODO: Migrate to import from `util/email.ts`.
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

Comment:
"${comment.message}"

Use the following link to accept the comment:
${service_url}/accept/${comment.id}/${comment.accept_token}

If you don't want to accept the comment, you don't need to do anything.`,
    };

    return transporter.sendMail(mailOptions);
}
