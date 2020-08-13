const config = require('../../../config.json');
const { mollie, coingate } = require('./apis.js');

async function post(request, h) {
    switch (request.payload.payment_provider) {
        case 'mollie':
            return await mollie
                .post('', {
                    amount: {
                        value: request.payload.amount,
                        currency: config.donation.currency,
                    },
                    description: request.payload.description,
                    redirectUrl: `${request.payload.redirect_url}?donation_reference=${request.payload.reference}`,
                    method:
                        request.payload.method === 'mollie'
                            ? config.donation.mollie.other_methods
                            : request.payload.method,
                    metadata: {
                        donation_reference: request.payload.reference,
                    },
                })
                .then((r) => {
                    return request.server.methods
                        .knex('mollie_ids')
                        .insert({
                            reference: r.data.metadata.donation_reference,
                            mollie_id: r.data.id,
                        })
                        .then(() => {
                            return { auth_url: r.data['_links']['checkout']['href'] };
                        })
                        .catch((e) => {
                            console.error(e);
                            return h
                                .response({
                                    message: 'Error while storing the mollie_id.',
                                })
                                .code(500);
                        });
                })
                .catch((e) => {
                    console.error(e);
                    return h.response({ message: 'Mollie payment initiation failed.' }).code(502);
                });
            break;
        case 'coingate':
            return await coingate
                .post('', {
                    price_amount: request.payload.amount,
                    price_currency: config.donation.currency,
                    receive_currency: config.donation.currency,
                    title: request.payload.description,
                    success_url: `${request.payload.redirect_url}?donation_reference=${request.payload.reference}`,
                    cancel_url: request.payload.redirect_url,
                    order_id: request.payload.reference,
                })
                .then((r) => {
                    return { auth_url: r.data.payment_url };
                })
                .catch((e) => {
                    console.error(e);
                    return h.response({ message: 'CoinGate payment initiation failed.' }).code(502);
                });
            break;
    }
}

module.exports = post;
