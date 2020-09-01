const { verifyPaths } = require('../services/setup');
const { logDanger, logNormal, logHeader, logWarning } = require('../services/logging');
const { fetchJson } = require('../services/fetch');
const { askQuestion } = require('../services/question');

const fs = require('fs');
const execute = require('async-execute');
const path = require('path');

const githubContentsURL = `https://api.github.com/repos/%/contents`;
const githubRawSetup = `https://raw.githubusercontent.com/%/master/.altv`;

async function handleInstall(fullRepositoryName) {
    if (!fullRepositoryName || !fullRepositoryName.includes('/')) {
        logDanger("Repo name must be 'author/path'. ie. 'altv-install i stuyk/altv-os-auth'");
        process.exit(1);
    }

    if (!verifyPaths()) {
        process.exit(1);
    }

    const response = await fetchJson(githubContentsURL.replace('%', fullRepositoryName)).catch((err) => {
        return false;
    });

    // Kill
    if (!response || !Array.isArray(response)) {
        logDanger('Failed to fetch repository contents.', true);
    }

    const index = response.findIndex((file) => {
        if (file.name === '.altv') {
            return true;
        }
    });

    // Kill
    if (index <= -1) {
        const msg = `${fullRepositoryName} does not have a file called '.altv' in their main directory. Please create one or ask the author to.`;
        logDanger(msg, true);
    }

    const rawResponse = await fetchJson(githubRawSetup.replace('%', fullRepositoryName)).catch(() => {
        return false;
    });

    // Kill
    if (!Array.isArray(rawResponse) || rawResponse.length <= 0) {
        logDanger(`${fullRepositoryName} does not have installation instructions.`, true);
    }

    const repoName = fullRepositoryName.replace(/^[^\/]*\//gm, '');
    const pkgJson = JSON.parse(fs.readFileSync('./package.json').toString());
    const questionResponses = [];
    const postInstallInstructions = [];

    // Kill
    if (!pkgJson) {
        logDanger(`Failed to parse package.json for local directory.`, true);
    }

    if (!fs.existsSync(path.join(`./resources`, repoName))) {
        await execute(`git clone https://github.com/${fullRepositoryName}/ ./resources/${repoName}`, { pipe: true });
    }

    for (let i = 0; i < rawResponse.length; i++) {
        const instruction = rawResponse[i];
        if (instruction.type === 'package' || instruction.type === 'pkg') {
            if (pkgJson.dependencies[instruction.name]) {
                continue;
            }

            pkgJson.dependencies[instruction.name] = instruction.version ? instruction.version : 'latest';
            logNormal(`Added NPM Package ${instruction.name}`);
            continue;
        }

        if (instruction.type === 'question' || instruction.type === '?') {
            if (!instruction.question || instruction.question === '') {
                continue;
            }

            const qResponse = await askQuestion(instruction.question);
            if (!qResponse) {
                continue;
            }

            questionResponses.push(qResponse);
            continue;
        }

        if (instruction.type === 'postinstall') {
            const resourcePath = path.join('./resources/', repoName);
            const filePath = path.join(resourcePath, instruction.file);

            if (!fs.existsSync(filePath)) {
                logDanger(`Post install file does not exist: ${filePath}`);
                continue;
            }

            postInstallInstructions.push(`node ./resources/${repoName}/${instruction.file}`);
            continue;
        }
    }

    logNormal(`Updated 'package.json' with Dependencies`);
    fs.writeFileSync('package.json', JSON.stringify(pkgJson, null, '\t'));

    if (questionResponses.length >= 1) {
        const responsePath = path.join(`./resources/${repoName}/`, 'responses.json');
        if (fs.existsSync(responsePath)) {
            fs.unlinkSync(responsePath);
        }

        fs.writeFileSync(responsePath, JSON.stringify(questionResponses));
    }

    if (postInstallInstructions.length >= 1) {
        const postWarn = `Warning: We are not responsible for what a post install script does. We ask that you read their install script yourself.`;
        logWarning(postWarn);
        const response = await askQuestion(`This resource has post install scripts. Did you want to run them? (y/n)`);
        if (response.toLowerCase().includes('y')) {
            logNormal(`Running Post Install Scripts`);
            for (let i = 0; i < postInstallInstructions.length; i++) {
                const cmd = postInstallInstructions[i];
                await execute(cmd, { pipe: true });
                logNormal(`[${i + 1}/${postInstallInstructions.length}]`);
            }
        }
    }

    logNormal(`Updating Installation`);
    await execute(`npm install`, { pipe: true });
    logHeader(`Add '${repoName}' to your 'server.cfg' file in your 'resources' section. Goodbye!`);
    process.exit(0);
}

module.exports = {
    handleInstall,
};
