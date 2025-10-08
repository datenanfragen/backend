// Taken from: https://stackoverflow.com/a/64093016/3211062
function partition(array, predicate) {
    return array.reduce(
        (acc, item) => (predicate(item) ? (acc[0].push(item), acc) : (acc[1].push(item), acc)),
        [[], []]
    );
}

function stripTags(str) {
    return str.replace(/<[^>]+>/gi, '');
}

const generateReference = (date) => date.getFullYear() + '-' + Math.random().toString(36).substring(2, 9).toUpperCase();

module.exports = { partition, stripTags, generateReference };
