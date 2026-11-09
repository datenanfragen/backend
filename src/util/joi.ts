import Joi from 'joi';

export const html_checkbox = Joi.alternatives()
    .try(Joi.boolean(), Joi.string())
    .custom((value) => !!value, 'checkbox validation')
    .default(false);
