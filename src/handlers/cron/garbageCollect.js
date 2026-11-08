const config = require('../../../config.json');

async function garbageCollect(request, h) {
    let commentLifetime = new Date();
    commentLifetime.setDate(commentLifetime.getDate() - config.comments.retention_days);
    let donationLifetime = new Date();
    donationLifetime.setDate(donationLifetime.getDate() - config.donation.retention_days);

    try {
        await request.server.methods
            .knex('comments')
            .where('added_at', '<', commentLifetime.toISOString())
            .andWhere('is_accepted', false)
            .del();

        await request.server.methods.knex('mollie_ids').where('added_at', '<', donationLifetime.toISOString()).del();

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
}

module.exports = garbageCollect;
