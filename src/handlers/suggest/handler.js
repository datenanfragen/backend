const config = require('../../../config.json');
const request = require('request'); // request is deprecated, but we depend on it through other packages, so we might as well use it.
const jsonDiff = require('json-diff');
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({
    auth: config.suggest.github_token,
    userAgent: 'Datenanfragen.de suggest-api',
});

/**
 * Returns `JSON.stringify()`'s output for a new entry, otherwise it returns a diff by downloading the old entry from `raw.github.com`.
 * Uses `old_json` to cache the old entry.
 * @param request_body
 * @returns {Promise<string|*>}
 */
async function getMessageContent(request_body) {
    if (request_body.new) return JSON.stringify(request_body.data, null, 4);

    // an update was suggested, lets make a diff!
    const url = `https://raw.githubusercontent.com/${config.suggest.owner}/${config.suggest.repo}/${config.suggest.branch}/companies/${request_body.data.slug}.json`;

    // wrap request in Promise, see https://stackoverflow.com/a/51162901
    old_json = await new Promise((resolve, reject) => {
        request({ uri: url }, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                console.error(error);
                console.error(`Responsecode: ${response.statusCode}`);
                reject(`Request to ${url} failed`);
            }
            resolve(body);
        });
    });
    return jsonDiff.diffString(JSON.parse(old_json), request_body.data, { color: '' });
}

async function messageBody(request_body) {
    return `The following suggestion was submitted through the website:

\`\`\`${request_body.new ? '' : 'diff'}
${await getMessageContent(request_body)}
\`\`\`

**[Edit](https://company-json.netlify.com/#!doc=${encodeURIComponent(JSON.stringify(request_body.data))})**`;
}

async function suggest(request, h) {
    old_json = null;
    try {
        const request_body = request.payload;

        const result = await octokit.issues.create({
            owner: config.suggest.owner,
            repo: config.suggest.repo,
            title: request_body.new
                ? 'New company suggestion' + (request_body.data.name ? ': `' + request_body.data.name + '`' : '')
                : 'Suggested update for company `' + request_body.data.slug + '`',
            // we create the issue just with the raw submission as body
            // this is overwritten later on: the issue is added as source and it becomes a diff if this was an update
            // but in case that second step fails, we have saved the raw data
            body: JSON.stringify(request_body.data),
        });

        if (result.status !== 201) {
            return h.response({ message: 'Failed to create GitHub issue.' }).code(502);
        }

        const issue_url = `https://github.com/${config.suggest.owner}/${config.suggest.repo}/issues/${result.data.number}`;

        // We only know the issue URL to include in the sources *after* the issue has been created, unfortunately, so we need to edit it.
        if (request_body.data.sources) request_body.data.sources.push(issue_url);
        else request_body.data.sources = [issue_url];
        await octokit.issues.update({
            owner: config.suggest.owner,
            repo: config.suggest.repo,
            issue_number: result.data.number,
            body: await messageBody(request_body),
        });

        return h
            .response({
                message: 'Issue created successfully.',
                issue_number: result.data.number,
                issue_url: issue_url,
            })
            .code(201);
    } catch (e) {
        console.error(e);
        return h.response({ message: 'Internal Server Error' }).code(500);
    }
}

module.exports = suggest;
