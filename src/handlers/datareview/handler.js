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
    let handlers = [/*address_remove_company,*/ remove_slug];
    for (a_handler of handlers) {
        result = await a_handler(result);
    }

    const diff = gitDiff(JSON.stringify(suggestion, null, 4), JSON.stringify(result, null, 4));
    if (diff === undefined) return h.response({ message: 'Nothing to change.' }).code(200);
    const fakeDiffPrefix = 'diff --git a/a.json b/b.json\nindex 1234567..1234567 100644\n--- a/a.json\n+++ b/b.json\n';
    const fakeDiffString = (fakeDiffPrefix + diff).replace('\n', `'\\n`);
    const hunks = gitDiffParser.parse(fakeDiffString)[0].hunks; // TODO undefined

    linechanges = {};

    for (hunk of hunks) {
        for (change of hunk.changes) {
            if (change.isNormal) continue;
            linechanges[change.lineNumber] = {};
            if (change.isDelete) {
                console.log('D', change.lineNumber, change.content);
                linechanges[change.lineNumber].delete = true;
            } else if (change.isInsert) {
                console.log('I', change.lineNumber, change.content);
                linechanges[change.lineNumber].insert = change.content;
            }
        }
    }

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

    //return JSON.stringify(result, null, 4);
    // TODO: determine which lines are affected, only comment on those
    // atm we do not support the addition or removal of lines
    await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        body,
        event: 'COMMENT',
        comments: reviewcomments,
    });

    //TODO: Don't delete old lines by inserting new ones
    //TODO: linebreaks in diff
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
    let tmp = suggestion;
    tmp.testparameter = 'some new line';
    return tmp;
}

module.exports = datadiff;
