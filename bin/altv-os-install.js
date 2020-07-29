#!/usr/bin/env node
import chalk from 'chalk';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import execute from 'async-execute';
import rl from 'readline';

const readline = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const args = [...process.argv];
args.shift();
args.shift();

const repoName = args.length >= 1 ? args.shift() : null;

if (!repoName) {
    console.log(chalk.redBright(`Usage: altv-install <author/repository_name>`));
    process.exit(1);
}

if (!fs.existsSync(path.join('./', 'resources'))) {
    console.log(
        chalk.redBright(
            `You are not in your main server folder. Run this command from your 'exe' or '.sh' location for alt:V`
        )
    );
    process.exit(1);
}

if (!fs.existsSync('./package.json')) {
    console.log(chalk.redBright(`Your gamemode does not include a 'package.json' please run 'npm init'`));
    process.exit(1);
}

if (repoName) {
    handleResourceGet(repoName);
}

async function handleResourceGet(repo) {
    const repoArtifact = repo.replace(/^[^\/]*\//gm, '');

    let url;
    let response;
    let data;

    url = `https://api.github.com/repos/${repo}/contents`;
    response = await fetch(url).catch((err) => {
        console.log(err);
        return null;
    });

    data = await response.json();
    if (data && data.message && data.message.includes('Not Found')) {
        console.log(chalk.redBright(`Failed to fetch repository for ${repo}`));
        process.exit(1);
    }

    if (!Array.isArray(data)) {
        console.log(chalk.redBright(`Something went wrong when fetching ${repo}. Try again later.`));
        process.exit(1);
    }

    const index = data.findIndex((file) => {
        if (file.name === '.altv') {
            return true;
        }
    });

    if (index <= -1) {
        console.log(chalk.redBright(`${repo} does not have a '.altv' file. Please ask the author to create one.`));
        process.exit(1);
    }

    url = `https://raw.githubusercontent.com/${repo}/master/.altv`;
    response = await fetch(url).catch((err) => {
        console.log(err);
        return null;
    });

    data = null;

    try {
        data = await response.json();
    } catch (err) {
        console.log(
            chalk.redBright(`${repo} has a bad JSON format. Ask the author to lint their '.altv' file for JSON.`)
        );
        process.exit(1);
    }

    if (!Array.isArray(data) || data.length <= 0) {
        console.log(chalk.redBright(`${repo} does not have any installation instructions.`));
        process.exit(1);
    }

    const pkgJson = JSON.parse(fs.readFileSync('./package.json').toString());
    const responses = [];
    const postInstallInstructions = [];

    if (!fs.existsSync(path.join(`./resources`, repoArtifact))) {
        await execute(`git clone https://github.com/${repo}/ ./resources/${repoArtifact}`, { pipe: true });
    }

    for (let i = 0; i < data.length; i++) {
        const instruction = data[i];

        if (instruction.type === 'package' || instruction.type === 'pkg') {
            if (pkgJson.dependencies[instruction.name]) {
                continue;
            }

            pkgJson.dependencies[instruction.name] = instruction.version ? instruction.version : 'latest';
            console.log(chalk.cyanBright(`Added Package: ${instruction.name}`));
            continue;
        }

        if (instruction.type === 'question' || instruction.type === '?') {
            if (!instruction.question || instruction.question === '') {
                continue;
            }

            const qResponse = await question(instruction.question);
            if (!qResponse) {
                continue;
            }

            responses.push(qResponse);
            console.log(chalk.cyanBright(`Recorded Input\r\n`));
            continue;
        }

        if (instruction.type === 'postinstall') {
            const resourcePath = path.join('./resources/', repoArtifact);
            const filePath = path.join(resourcePath, instruction.file);

            if (!fs.existsSync(filePath)) {
                console.log(chalk.redBright(`Post install file does not exist: ${filePath}`));
                continue;
            }

            postInstallInstructions.push(`node ./resources/${repoArtifact}/${instruction.file}`);
            continue;
        }
    }

    console.log(chalk.cyanBright(`Updating package.json...`));
    fs.writeFileSync('package.json', JSON.stringify(pkgJson, null, '\t'));

    if (responses.length >= 1) {
        console.log(chalk.magentaBright(`Writing responses [${responses.length}]`));
        const responsePath = path.join(`./resources/${repoArtifact}/`, 'responses.json');
        if (fs.existsSync(responsePath)) {
            fs.unlinkSync(responsePath);
        }

        fs.writeFileSync(responsePath, JSON.stringify(responses));
    }

    if (postInstallInstructions.length >= 1) {
        console.log(chalk.magentaBright(`Running Post Install Scripts [${postInstallInstructions.length}]`));
        for (let i = 0; i < postInstallInstructions.length; i++) {
            console.log(chalk.magentaBright(`Running... [${i + 1}/${postInstallInstructions.length}]`));
            const cmd = postInstallInstructions[i];
            await execute(cmd, { pipe: true });
        }
    }

    await execute(`npm install`, { pipe: true });

    console.log(chalk.cyanBright(`Add '${repoArtifact}' to your 'server.cfg' file.`));
    console.log(chalk.greenBright(`Done!`));
    process.exit(1);
}

async function question(question) {
    return new Promise((resolve) => {
        readline.question(`\r\n${question} [ENTER] on Completion / Skip (Not Recommended)\r\n`, (response) => {
            if (!response || response === '' || response === 'skip') {
                response = false;
            }

            if (response) {
                response = response.trim();
            }

            resolve(response);
        });
    });
}
