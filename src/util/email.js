const config = require('../../config.json');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: config.email.smtp_host,
    port: config.email.smtp_port,
    secure: !!config.email.smtp_secure,
    auth: {
        user: config.email.smtp_user,
        pass: config.email.smtp_password,
    },
});

module.exports = { transporter };
