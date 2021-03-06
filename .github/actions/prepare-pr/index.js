const fs = require('fs');
const core = require('@actions/core');

function prTitle(version) {
    return `Prepare Release ${version}`
}
function prBody(b) {
    let body = `This PR is auto-generated by
[create-pull-request](https://github.com/peter-evans/create-pull-request)
to prepare new releases for changed packages.\n\n`;
    body += b;
    return body;
}
function commitMessage(version) {
    return `chore(release): version ${version}`
}

async function main(output) {
    const { version } = JSON.parse(fs.readFileSync(`package.json`).toString());
    const changelog = fs.readFileSync('CHANGELOG.md').toString();
    const changelogLines = changelog.split('\n')

    const start = changelogLines.findIndex(l => l.startsWith('## '));
    const end = changelogLines.slice(start + 1).findIndex(l => l.startsWith('## '))
    const body = changelogLines.slice(start, start + end).join('\n') + '\n';

    console.log(body);

    output('title', prTitle(version));
    output('body', prBody(body));
    output('message', commitMessage(version));
}

main(core ? core.setOutput : (k, v) => {
    console.log(k)
    console.log(v)
});
