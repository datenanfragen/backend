const config = require('../../../config.json');
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({
    auth: config.suggest.github_token,
    userAgent: 'Datenanfragen.de suggest-api',
});

function messageBody(data) {
    return `The following suggestion was submitted through the website:

\`\`\`        
${JSON.stringify(data, null, 4)}
\`\`\`

**[Edit](https://company-json.netlify.com/#!doc=${encodeURIComponent(JSON.stringify(data))})**`;
}

async function suggest(request, h) {
    try {
        const request_body = request.payload;
        if (request_body.for !== 'cdb') {
            return h.response({ message: 'Unrecognized value for parameter `for`.' }).code(400);
        }

        const result = await octokit.issues.create({
            owner: config.suggest.owner,
            repo: config.suggest.repo,
            title: request_body.new
                ? 'New company suggestion' + (request_body.data.name ? ': `' + request_body.data.name + '`' : '')
                : 'Suggested update for company `' + request_body.data.slug + '`',
            body: messageBody(request_body.data),
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
            body: messageBody(request_body.data),
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
