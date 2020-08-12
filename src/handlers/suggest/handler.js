const config = require('../../../config.json');
const { Octokit } = require('@octokit/rest');
const { createPullRequest } = require('octokit-plugin-create-pull-request');

const myOctokit = Octokit.plugin(createPullRequest);
const octokit = new myOctokit({
    auth: config.suggest.github_token,
    userAgent: 'Datenanfragen.de suggest-api',
});

async function suggest(request, h) {
    try {
        const request_body = request.payload;

        const files = {
            ['companies/' + request_body.data.slug + '.json']: JSON.stringify(request_body.data, null, 4) + '\n',
        };

        const title = request_body.new
            ? 'New company suggestion' + (request_body.data.name ? ': `' + request_body.data.name + '`' : '')
            : 'Suggested update for company `' + request_body.data.slug + '`';

        const commit_msg =
            (request_body.new
                ? 'Add ' + (request_body.data.name ? ': `' + request_body.data.name + '`' : '')
                : 'Update `' + request_body.data.slug + '`') + ' (community contribution)';

        const pr = await new Promise((resolve, reject) => {
            octokit
                .createPullRequest({
                    owner: config.suggest.owner,
                    repo: config.suggest.repo,
                    base: config.suggest.branch,
                    title,
                    body: 'This suggestion was submitted through the website.',
                    head: 'suggest_' + request_body.data.slug + '_' + Date.now(),
                    changes: [
                        {
                            files,
                            commit: commit_msg,
                        },
                    ],
                })
                .then((pr) => resolve(pr))
                .catch((e) => reject(e));
        });

        const pr_url = `https://github.com/${config.suggest.owner}/${config.suggest.repo}/pull/${pr.data.number}`;

        return h
            .response({
                message: 'PR created successfully.',
                pr_number: pr.data.number,
                url: pr_url,
                issue_url: pr_url, // legacy support
            })
            .code(201);
    } catch (e) {
        console.error(e);
        return h.response({ message: 'Internal Server Error' }).code(500);
    }
}

module.exports = suggest;
