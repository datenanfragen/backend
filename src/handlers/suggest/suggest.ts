import config from '../../../config.json' with { type: 'json' };
import { Octokit } from '@octokit/rest';
import { createPullRequest } from 'octokit-plugin-create-pull-request';
import type { HapiHandler } from '../../util/types.ts';

type Company = {
    slug: string;
    'relevant-countries': string[];
    name?: string;
    web?: string;
    sources: string[];
    address?: string;
    [key: string]: unknown;
};

const myOctokit = Octokit.plugin(createPullRequest);
const octokit = new myOctokit({
    auth: config.suggest.github_token,
    userAgent: 'Datenanfragen.de suggest-api',
});

function cleanElement<ElementT>(element: ElementT): ElementT {
    // Trim strings
    if (typeof element === 'string') return element.trim() as ElementT;

    // Remove null values from array properties
    if (Array.isArray(element)) return element.filter(Boolean).map((elem) => cleanElement(elem)) as ElementT;

    return element;
}

function cleanCompanyData(company: Company) {
    return Object.fromEntries(
        Object.keys(company)
            // Remove all `null` and `undefined` values & all null values inside array properties
            .filter((key) => company[key] !== null && company[key] !== undefined)
            // Trim all strings
            .map((key) => [key, cleanElement(company[key])]),
    ) as Company;
}

export const suggest: HapiHandler = async (request, h) => {
    const payload = request.payload as {
        for: 'cdb';
        new: boolean;
        data: Company;
        comment: string;
    };

    let company = cleanCompanyData(payload.data);

    const file_path = `companies/${company.slug}.json`;
    const files = {
        [file_path]: JSON.stringify(company, null, 4) + '\n',
    };

    const title =
        (payload.new ? `Add '${company.name || company.web}'` : `Update '${company.name || company.slug}'`) +
        ' (community contribution)';
    const branch_name = `suggest_${company.slug}_${Date.now()}`;

    return await octokit
        .createPullRequest({
            owner: config.suggest.owner,
            repo: config.suggest.repo,
            base: config.suggest.branch,
            title,
            body: 'This suggestion was submitted through the website.',
            head: branch_name,
            changes: [
                {
                    files,
                    commit: title,
                },
            ],
        })
        .then((pr) => {
            if (pr && pr.data) {
                company.sources.push(pr.data.html_url);

                return commitStringFileToPullRequest(
                    pr.data.head.user.login,
                    config.suggest.repo,
                    pr.data,
                    file_path,
                    JSON.stringify(company, null, 4) + '\n', // File content
                    title,
                )
                    .then(() =>
                        octokit.pulls.update({
                            owner: config.suggest.owner,
                            repo: config.suggest.repo,
                            pull_number: pr.data.number,
                            body: `This suggestion was submitted through the website.

**Edit in: [company JSON generator](https://company-json.datenanfragen.de/#!url=${encodeURIComponent(
                                `https://raw.githubusercontent.com/${config.suggest.token_owner}/${config.suggest.repo}/${branch_name}/${file_path})`,
                            )}, [data editor](https://data-editor.datenanfragen.de/#/review/${pr.data.number})[^1]**

[^1]: Closed beta`,

                            maintainer_can_modify: true, // We cannot set this setting through the plugin, but because it is just a gimmick, we can do it afterwards just as well.
                        }),
                    )
                    .then(() =>
                        payload.comment && payload.comment.length > 0
                            ? // Submitting a separate comment has two advantages over adding this to the PR body:
                              // 1. It is more visible (especially in data-editor).
                              // 2. It can be deleted much more easily if necessary.
                              octokit.issues.createComment({
                                  owner: config.suggest.owner,
                                  repo: config.suggest.repo,
                                  issue_number: pr.data.number,
                                  body:
                                      'The submitter left the following additional comment:\n\n' +
                                      payload.comment
                                          .trim()
                                          .split('\n')
                                          .map((l) => '> ' + l)
                                          .join('\n'),
                              })
                            : undefined,
                    )
                    .then(() =>
                        octokit.issues.addLabels({
                            owner: config.suggest.owner,
                            repo: config.suggest.repo,
                            issue_number: pr.data.number,
                            labels: ['record', 'via-suggest-api'],
                        }),
                    )
                    .then(() =>
                        h
                            .response({
                                message: 'Successfully posted pull request to GitHub',
                                number: pr.data.number,
                                url: pr.data.html_url,
                                issue_url: pr.data.html_url, // legacy support
                            })
                            .code(201),
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

**[Edit](https://company-json.datenanfragen.de/#!doc=${encodeURIComponent(JSON.stringify(company))} )**`,
                })
                .then((result) =>
                    h
                        .response({
                            message: 'Successfully posted issue to GitHub',
                            number: result.data.number,
                            url: result.data.html_url,
                            issue_url: result.data.html_url, // legacy support
                        })
                        .code(201),
                )
                .catch((e) => {
                    console.error(e);
                    return h.response({ message: 'Bad Gateway. Failed to create issue.' }).code(502);
                });
        });
};

function commitStringFileToPullRequest(
    owner: string,
    repo: string,
    pr: {
        head: { ref: string };
        base: { sha: string };
    },
    path: string,
    file_content: string,
    commit_message: string,
) {
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
                        }),
                    )
                    // Force pushing is actually just updating the reference.
                    .then((new_commit) =>
                        octokit.git.updateRef({
                            owner,
                            repo,
                            ref: 'heads/' + pr.head.ref,
                            sha: new_commit.data.sha,
                            force: true,
                        }),
                    )
            );
        });
}
