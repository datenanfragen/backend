function stripTags(str) {
    return str.replace(/<[^>]+>/gi, '');
}

const generateReference = (date) => date.getFullYear() + '-' + Math.random().toString(36).substring(2, 9).toUpperCase();

module.exports = { stripTags, generateReference };
