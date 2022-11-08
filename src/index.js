const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/rest");

const token = core.getInput('token');
const octokit = new Octokit({ auth: token });
const repoOwner = github.context.repo.owner
const repo = github.context.repo.repo
const baseBranch = github.context.payload.ref

const getPullRequests = async () => {
    const resp = octokit.rest.pulls.list({
        owner: repoOwner,
        repo: repo,
        sort: 'long-running',
        direction: 'asc',
    }).catch(
        e => {
            core.setFailed(e.message)
        }
    )
    console.log('resp', resp);
    return resp;
};

const updateBranch = async (filteredPrs) => {
    if (github.context.ref === `refs/heads/${baseBranch}`) {
        return {
            type: 'warning',
            msg: 'Commit is already on the destination branch, ignoring',
        };
    }
    filteredPrs.map(async (pr) => {
        console.log('ref', github.context.ref);
        try {
            await octokit.request(
                'PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch',
                {
                    owner: repoOwner,
                    repo: repo,
                    pull_number: pr.number,
                }
            ).then(() => {
                console.log('updated', filteredPrs[0].number);
                return;
            });
        } catch (error) {
            console.warn('error', error);
        }
    })
    
};

async function main() {
    const pullRequestsList = await getPullRequests();

    const filteredPrs = pullRequestsList.data
        .filter((pr) => pr.auto_merge !== null)
        .sort((a, b) => {
            return Date.parse(b.created_at) - Date.parse(a.created_at);
        });
    console.log(filteredPrs);

    filteredPrs.map((pr) => { console.log(`Pull Request - ${pr.number} ${pr.created_at}`)})

    if (!filteredPrs.length) {
        console.log('auto-merge prs is not found');
        return
    }
    if (filteredPrs.error) console.log(filteredPrs.error);  
    updateBranch(filteredPrs);
};

main();