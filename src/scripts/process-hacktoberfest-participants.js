const knex = require('knex')(require('../../knexfile').development);
const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');
const { retry } = require('@octokit/plugin-retry');

const config = require('../../config.json');
const { nanoid } = require('nanoid');

const ALLOWED_REPOS = [
    'datenanfragen/website',
    'datenanfragen/data',
    'datenanfragen/backend',
    'datenanfragen/company-json-generator',
    'datenanfragen/letter-generator',
    'datenanfragen/media',
    'datenanfragen/locate-contacts-addon',
    'zner0L/postcss-fonticons',
];
const REPO_QUERY = ALLOWED_REPOS.map((r) => `repo:${r}`).join(' ');

const octokit = new (Octokit.plugin(throttling, retry))({
    auth: config.hacktoberfest.github_token,
    throttle: {
        onRateLimit: (retryAfter, options) => {
            octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
            if (options.request.retryCount <= 5) {
                console.log(`Retrying after ${retryAfter} seconds.`);
                return true;
            }
        },
        onAbuseLimit: (retryAfter, options) => {
            octokit.log.error(`Abuse detected for request ${options.method} ${options.url}`);
        },
    },
});

async function main() {
    const date = new Date();
    const year = date.getFullYear();
    if (date.toISOString() < `${year}-11-05`) {
        console.error('Processing can only occur after the registration deadline has passed');
        process.exit(1);
    }

    const users_without_token = await knex('hacktoberfest')
        .select()
        .where({ token: null })
        .orWhere({ token: 'invalid' });
    for (const user of users_without_token) {
        await knex('hacktoberfest').where({ github_user: user.github_user }).update({ token: nanoid() });
    }

    const participants = await knex('hacktoberfest').select().where({ year });
    for (const participant of participants) {
        try {
            const res = await octokit.search.issuesAndPullRequests({
                q: `type:pr author:${participant.github_user} created:${year}-10-01..${year}-11-01 ${REPO_QUERY}`,
            });
            if (res.data.incomplete_results !== false) {
                console.error('Incomplete results!');
                process.exit(1);
            }

            const prs = res.data.items;
            const eligible_prs = prs.filter((p) => !p.labels.find((l) => l.name === 'invalid'));

            await knex('hacktoberfest')
                .where({ github_user: participant.github_user })
                .update({
                    pr_urls: eligible_prs.map((p) => p.html_url).join(', '),
                    completed_challenge: eligible_prs.length > 0,
                });
        } catch (err) {
            console.error('Processing user', participant.github_user, 'failed:', err);
        }
    }
    console.log('Done.');
}

main();
