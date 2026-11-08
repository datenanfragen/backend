const Joi = require('joi');

const html_checkbox = Joi.alternatives()
    .try(Joi.boolean(), Joi.string())
    .custom((value) => !!value, 'checkbox validation')
    .default(false);

module.exports = { html_checkbox };
