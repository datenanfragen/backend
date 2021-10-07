// Taken from: https://stackoverflow.com/a/64093016/3211062
function partition(array, predicate) {
    return array.reduce((acc, item) => (predicate(item) ? (acc[0].push(item), acc) : (acc[1].push(item), acc)), [
        [],
        [],
    ]);
}

function stripTags(str) {
    return str.replace(/<[^>]+>/gi, '');
}

module.exports = { partition, stripTags };
