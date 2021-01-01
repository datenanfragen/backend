const config = require('../../../config.json');
async function getComments(request, h) {
    const where_clause = { is_accepted: true, ...(request.params.target && { target: request.params.target }) };
    return await request.server.methods
        .knex('comments')
        .select()
        .where(where_clause)
        .limit(request.params.target ? config.comments.limit : Number.MAX_SAFE_INTEGER)
        .then((data) =>
            data.map((item) => {
                try {
                    item.additional = JSON.parse(item.additional);
                } catch (_) {
                    item.additional = {};
                }

                return item;
            })
        )
        .then((data) => {
            switch (request.params.action) {
                case 'get':
                    return data;
                case 'feed':
                    return h.response(atomFeedForItems(data, request.params.target)).type('application/atom+xml');
            }
        })
        .catch((e) => {
            console.error(e);
            return h.response({ message: 'Fetching the comments failed.' }).code(500);
        });
}

function atomFeedForItems(items, target) {
    const feed_updated = items.reduce(
        (acc, cur) => (cur.added_at > acc ? cur.added_at : acc),
        '1970-01-01T00:00:00.000Z'
    );

    // Excerpt regex taken from https://stackoverflow.com/a/5454297
    const entries = items.map(
        (item) => `    <entry>
        <title>${!target ? item.target + ':' : ''}${item.message
            .replace(/\s+/g, ' ')
            .replace(/^(.{40}[^\s]*).*/, '$1')}</title>
        <id>datenanfragenDE:${item.target}:comment:${item.id}</id>
        <updated>${item.added_at}</updated>
        <author><name>${item.author}</name></author>
        <content type="text">${item.message}</content>
    </entry>`
    );

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>${target || 'All comments'}</title>
    <updated>${feed_updated}</updated>
    <id>datenanfragenDE:${target || 'all'}:comments</id>
    <generator uri="https://github.com/datenanfragen/backend">Datenanfragen.de backend</generator>

${entries.join('\n')}
</feed>
`;
}

module.exports = getComments;
