const axios = require('axios');
const config = require('../../../config.json');

const mollie = axios.create({
    baseURL: config.donation.mollie.endpoint,
    timeout: 1000,
    headers: {
        Authorization: 'Bearer ' + config.donation.mollie.api_key,
        'Content-Type': 'application/json',
    },
});

const coingate = axios.create({
    baseURL: config.donation.coingate.endpoint,
    timeout: 1000,
    headers: {
        Authorization: 'Token ' + config.donation.coingate.api_key,
        'Content-Type': 'application/json',
    },
});

module.exports = { mollie, coingate };
