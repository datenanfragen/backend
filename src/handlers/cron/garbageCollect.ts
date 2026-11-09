import config from '../../../config.json' with { type: 'json' };
import type { HapiHandler } from '../../util/types.ts';

export const garbageCollect: HapiHandler = async (request, h) => {
    let commentLifetime = new Date();
    commentLifetime.setDate(commentLifetime.getDate() - config.comments.retention_days);

    try {
        await request.server.methods
            .knex('comments')
            .where('added_at', '<', commentLifetime.toISOString())
            .andWhere('is_accepted', false)
            .del();

        return {
            message: 'Garbage collection completed sucessfully.',
        };
    } catch (e) {
        console.error(e);
        return h
            .response({
                message: 'There was an error while garbage collecting.',
            })
            .code(500);
    }
};
