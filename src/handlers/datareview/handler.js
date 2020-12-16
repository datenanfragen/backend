const config = require('../../../config.json');
const { Octokit } = require('@octokit/rest');
const fetch = require('node-fetch');
const gitDiff = require('git-diff');
const gitDiffParser = require('gitdiff-parser');

const octokit = new Octokit({
    auth: config.suggest.github_token,
    userAgent: 'Datenanfragen.de datareview-api',
    //accept: 'application/vnd.github.comfort-fade-preview+json',
});

async function datadiff(request, h) {
    // TODO dont hardcode these
    const file = 'companies/named-company.json';

    const pull_number = request.params.PR;
    const owner = config.suggest.owner;
    const repo = config.suggest.repo;
    const pr = await octokit.pulls.get({ owner, repo, pull_number });

    // check if we want to run on this PR
    if (pr.data.state !== 'open') return h.response({ message: "Won't review closed PR." }).code(403);
    console.log(pr.data.number, pr.data.base.repo.full_name, `${owner}/${repo}`);
    if (pr.data.number !== pull_number || pr.data.base.repo.full_name !== `${owner}/${repo}`)
        return h.response().code(500);
    // TODO check if we ran already
    // TODO also support Updates
    // TODO support multiple files
    const pr_files = await octokit.pulls.listFiles({ owner, repo, pull_number });
    if (pr_files.data.length > 1) return h.response({ message: 'Multifile PRs are not supported.' }).code(501);
    const pr_file = pr_files.data[0];
    if (pr_file.deletions > 0) return h.response({ message: 'Update PRs are not supported.' }).code(501);
    if (pr_file.changes == 0) return h.response({ message: 'Nothing to do.' }).code(200); // just to be sure
    if (!/^https:\/\/github.com\//.test(pr_file.raw_url)) return h.response().code(501); // just to be sure pt 2

    const suggestion = await fetch(pr_file.raw_url).then((response) => response.json());
    console.log('RAW:', JSON.stringify(suggestion));
    if (suggestion === {}) return h.response({ message: 'Nothing to do.' }).code(200);

    let result = JSON.parse(JSON.stringify(suggestion)); // 🤦
    //TODO: add trimmer
    let handlers = [/*address_remove_company,*/ remove_slug, website];
    for (a_handler of handlers) {
        result = await a_handler(result);
    }

    const diff = gitDiff(JSON.stringify(suggestion, null, 4), JSON.stringify(result, null, 4));
    if (diff === undefined) return h.response({ message: 'Nothing to change.' }).code(200);
    const fakeDiffPrefix = 'diff --git a/a.json b/b.json\nindex 1234567..1234567 100644\n--- a/a.json\n+++ b/b.json\n';
    const fakeDiffString = (fakeDiffPrefix + diff).replace('\n', `'\\n`);
    const hunks = gitDiffParser.parse(fakeDiffString)[0].hunks; // TODO undefined

    linechanges = {};
    oldmax = 0;

    for (hunk of hunks) {
        for (change of hunk.changes) {
            if (change.isNormal) {
                oldmax = Math.max(oldmax, change.oldLineNumber);
                continue;
            }
            linechanges[change.lineNumber] = {};
            if (change.isDelete) {
                console.log('D', change.lineNumber, change.content);
                linechanges[change.lineNumber].delete = true; // unused
            } else if (change.isInsert) {
                console.log('I', change.lineNumber, change.content);
                if (!linechanges[change.lineNumber].insert) {
                    linechanges[change.lineNumber].insert = change.content;
                } else {
                    linechanges[change.lineNumber].insert += '\n' + change.content;
                }
            }
        }
    }

    const newmax = Math.max(...Object.keys(linechanges).map((x) => parseInt(x)));
    console.error(oldmax, newmax);
    let newlinechanges = JSON.parse(JSON.stringify(linechanges));
    console.log(linechanges);

    // merge inserted lines
    if (newmax > oldmax) {
        for (lineno of Object.keys(linechanges).map((x) => parseInt(x))) {
            if (lineno > oldmax) {
                newlinechanges[oldmax].insert += '\n' + linechanges[lineno].insert;
                delete newlinechanges[lineno];
            }
        }
    }
    console.log(newlinechanges);
    linechanges = newlinechanges;

    // add the old strings
    // e.g. line 9 was "test" before. But now we insert a new line after line 9: "new".
    // --> line 9 should be "new\ntest"
    for (hunk of hunks) {
        for (change of hunk.changes) {
            if (!change.isNormal) continue;
            if (change.oldLineNumber === change.newLineNumber) continue;
            if (linechanges[change.oldLineNumber] && linechanges[change.oldLineNumber].insert) {
                linechanges[change.oldLineNumber].insert += '\n' + change.content;
            } else {
                h.response({ message: 'TODO' }).code(501);
            }
        }
    }
    console.log(linechanges);

    // now merge adjacent changes
    for (let i = 0; i < oldmax; i++) {
        if (!(linechanges[i] && linechanges[i].insert)) continue;
        if (!(linechanges[i + 1] && linechanges[i + 1].insert)) continue;
        linechanges[i].insert += '\n' + linechanges[i + 1].insert;
        delete linechanges[i + 1];
    }
    console.log(linechanges);

    let reviewcomments = [];

    for (lineno in linechanges) {
        let comment = {
            path: file,
            position: parseInt(lineno, 10), // TODO this only works with NEW suggestions
        };
        comment.body = '```suggestion\n' + (linechanges[lineno].insert || '') + '\n```';
        reviewcomments.push(comment);
    }

    console.log(reviewcomments);

    const body = 'Beep Boop I am a bot and this is my suggestion:\n';
    await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        body,
        event: 'COMMENT',
        comments: reviewcomments,
    });
    //TODO: linebreaks in diff
    //TODO: deletion of lines not supported atm
    return result;
}

async function address_remove_company(suggestion) {
    let tmp = suggestion;
    if (tmp.address.startsWith(tmp.name)) {
        tmp.address = tmp.address.slice(tmp.name.length + 1);
    }
    return tmp;
}

async function remove_slug(suggestion) {
    let tmp = JSON.parse(JSON.stringify(suggestion));
    //delete tmp.slug;
    tmp.testparameter = 'some new line';
    tmp.testparametertwo = 'test';
    return tmp;
}

async function website(suggestion) {
    suggestion.website = 'example.com';
    return suggestion;
}

module.exports = datadiff;
