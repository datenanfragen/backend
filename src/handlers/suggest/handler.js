const config = require('../../../config.json');
const { Octokit } = require('@octokit/rest');
const { createPullRequest } = require('octokit-plugin-create-pull-request');

const myOctokit = Octokit.plugin(createPullRequest);
const octokit = new myOctokit({
    auth: config.suggest.github_token,
    userAgent: 'Datenanfragen.de suggest-api',
});

function cleanCompanyData(company) {
    // Remove all `null` and `undefined` values
    const cleanedCompany = Object.fromEntries(
        Object.keys(company)
            .filter((key) => company[key] !== null || company[key] !== undefined)
            .map((key) => {
                return [key, company[key]];
            })
    );

    // Trim all strings
    return Object.fromEntries(
        Object.keys(cleanedCompany).map((key) => {
            if (typeof cleanedCompany[key] !== 'string') return [key, cleanedCompany[key]];

            return [key, cleanedCompany[key].trim()];
        })
    );
}

async function suggest(request, h) {
    let company = cleanCompanyData(request.payload.data);

    const file_path = `companies/${company.slug}.json`;
    const files = {};
    files[file_path] = JSON.stringify(company, null, 4) + '\n';

    const title =
        (request.payload.new ? `Add '${company.name || company.web}'` : `Update '${company.name || company.slug}'`) +
        ' (community contribution)';

    return await octokit
        .createPullRequest({
            owner: config.suggest.owner,
            repo: config.suggest.repo,
            base: config.suggest.branch,
            title,
            body: 'This suggestion was submitted through the website.',
            head: `suggest_${company.slug}_${Date.now()}`,
            changes: [
                {
                    files,
                    commit: title,
                },
            ],
        })
        .then((pr) => {
            if (pr && pr.data) {
                // TODO: Replace with ?. in node 14
                company.sources.push(pr.data.html_url);

                return commitStringFileToPullRequest(
                    pr.data.head.user.login,
                    config.suggest.repo,
                    pr.data,
                    file_path,
                    JSON.stringify(company, null, 4) + '\n', // File content
                    title
                )
                    .then(() =>
                        octokit.pulls.update({
                            owner: config.suggest.owner,
                            repo: config.suggest.repo,
                            pull_number: pr.data.number,
                            body: `This suggestion was submitted through the website.

**[Edit](https://company-json.datenanfragen.de/#!doc=${encodeURIComponent(JSON.stringify(company))})**`,
                            maintainer_can_modify: true, // We cannot set this setting through the plugin, but because it is just a gimmick, we can do it afterwards just as well.
                        })
                    )
                    .then(() =>
                        octokit.issues.addLabels({
                            owner: config.suggest.owner,
                            repo: config.suggest.repo,
                            issue_number: pr.data.number,
                            labels: ['record', 'via-suggest-api'],
                        })
                    )
                    .then(() =>
                        h
                            .response({
                                message: 'Successfully posted pull request to GitHub',
                                number: pr.data.number,
                                url: pr.data.html_url,
                                issue_url: pr.data.html_url, // legacy support
                            })
                            .code(201)
                    )
                    .catch((e) => {
                        console.error(e);
                        return h
                            .response({
                                message: 'Bad Gateway. Failed to update PR.',
                                // Let's fail gently: This might be an error, but we already have a PR, so we can return all the information for it.
                                number: pr.data.number,
                                url: pr.data.html_url,
                                issue_url: pr.data.html_url,
                            })
                            .code(502);
                    });
            } else {
                throw Error('No PR has been created');
            }
        })
        .catch((e) => {
            console.error(e);
            console.log('Creating a PR failed, creating issue instead...');
            // creating a pr failed, so lets make an issue as fallback
            return octokit.issues
                .create({
                    owner: config.suggest.owner,
                    repo: config.suggest.repo,
                    title: title,
                    body:
                        '```json\n' +
                        JSON.stringify(company, null, 4) +
                        '\n```' +
                        `

**[Edit](https://company-json.datenanfragen.de/#!doc=${encodeURIComponent(JSON.stringify(company))})**`,
                })
                .then((result) =>
                    h
                        .response({
                            message: 'Successfully posted issue to GitHub',
                            number: result.data.number,
                            url: result.data.html_url,
                            issue_url: result.data.html_url, // legacy support
                        })
                        .code(201)
                )
                .catch((e) => {
                    console.error(e);
                    return h.response({ message: 'Bad Gateway. Failed to create issue.' }).code(502);
                });
        });
}

function commitStringFileToPullRequest(owner, repo, pr, path, file_content, commit_message) {
    return octokit.git
        .getCommit({
            owner: owner,
            repo: repo,
            commit_sha: pr.base.sha,
        })
        .then((commit) => {
            return (
                octokit.git
                    .createTree({
                        owner,
                        repo,
                        base_tree: commit.data.tree.sha,
                        tree: [
                            {
                                path,
                                mode: '100644', // This just means "file" apparently.
                                content: file_content,
                                type: 'blob',
                            },
                        ],
                    })
                    .then((tree) =>
                        octokit.git.createCommit({
                            owner,
                            repo,
                            message: commit_message,
                            tree: tree.data.sha,
                            parents: [commit.data.sha],
                        })
                    )
                    // Force pushing is actually just updating the reference.
                    .then((new_commit) =>
                        octokit.git.updateRef({
                            owner,
                            repo,
                            ref: 'heads/' + pr.head.ref,
                            sha: new_commit.data.sha,
                            force: true,
                        })
                    )
            );
        });
}

module.exports = suggest;
