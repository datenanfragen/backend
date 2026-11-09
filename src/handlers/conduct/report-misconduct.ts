import type { HapiHandler } from '../../util/types.ts';

import config from '../../../config.json' with { type: 'json' };
import { generateReference, stripTags } from '../../util/functions.ts';
import { transporter } from '../../util/email.ts';

export const reportMisconduct: HapiHandler = async (request, h) => {
    const { encryptedMessage } = request.payload as { encryptedMessage: string };

    const now = new Date();
    const reference = generateReference(now);
    const text = stripTags(encryptedMessage);

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
        .catch((e: Error) => {
            console.error(e);
            return h.response({ message: 'Error while sending report.' }).code(500);
        });
};
