const { mollie } = require('./apis.js');

async function state(request, h) {
    return await request.server.methods
        .knex('mollie_ids')
        .select()
        .where({ reference: request.params.reference })
        .then((rows) => {
            if (rows.length < 1) return h.response({ message: 'No mollie_id for that reference was found.' }).code(404);
            return mollie
                .get(rows[0].mollie_id)
                .then((r) => {
                    return {
                        status: r.data.status,
                        reference: r.data.metadata.donation_reference,
                    };
                })
                .catch((e) => {
                    console.error(e);
                    return h.response({ message: 'Fetching the state at mollie failed.' }).code(502);
                });
        })
        .catch((e) => {
            console.error(e);
            return h.response({ message: 'Fetching the mollie_id failed.' }).code(500);
        });
}

module.exports = state;
