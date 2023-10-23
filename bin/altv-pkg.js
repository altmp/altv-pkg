#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const crypto = require('crypto');
const RPC = require('discord-rpc');

const RC_FILE_NAME = ".altvpkgrc.json";
const CDN_ADDRESS = "cdn.alt-mp.com";
const DISCORD_ID = "580868196270342175"

const args = process.argv;
const rootPath = process.cwd();

let platform = process.platform == 'win32' ? 'x64_win32' : 'x64_linux';
let branch = null;

const { loadBytecodeModule, loadCSharpModule, loadJSV2Module } = loadRuntimeConfig();

function authorizeDiscord() {
    console.log(chalk.greenBright('===== Authorizing via Discord ====='));
    return new Promise(async (resolve, reject) => {
        try {
            const client = new RPC.Client({ transport: 'ipc' });
            client.on('ready', async () => {
                try {
                    const { code } = await client.request('AUTHORIZE', {
                        scopes: ['identify'],
                        client_id: DISCORD_ID,
                        prompt: 'none'
                    });
                    resolve(code);
                } catch (e) {
                    reject(e);
                    return;
                } finally {
                    client.destroy();
                }
            });

            await client.login({ clientId: DISCORD_ID });
        } catch (e) {
            reject(e);
        }
    });
}

async function authorizeCDN(code) {
    console.log(chalk.greenBright('===== Authorizing in CDN ====='));
    try {
        const res = await axios.get('https://qa-auth.alt-mp.com/auth', { responseType: 'json', headers: { Authorization: code } });
        return res.data.token;
    } catch (e) {
        if (e?.response?.status != 403) throw e;
        throw new Error("You do not have permissions to access this branch");
    }
}

for (let i = 0; i < args.length; i++) {
    if (args[i] === 'release') {
        branch = 'release';
        continue;
    }

    if (args[i] === 'rc') {
        branch = 'rc';
        continue;
    }

    if (args[i] === 'dev') {
        branch = 'dev';
        continue;
    }

    if (args[i].startsWith("qa")) {
        branch = args[i];
        continue;
    }

    if (args[i] === "windows") {
        platform = "x64_win32";
        continue;
    }

    if (args[i] === "linux") {
        platform = "x64_linux";
        continue;
    }
}

if (!branch) {
    console.log(chalk.redBright('Please specify a branch: release, rc, or dev. \r\nExample:\r'));
    console.log(chalk.green('npx altv-pkg release'));
    process.exit(0);
}

async function start() {
    console.log(chalk.greenBright('===== altv-pkg ====='));
    console.log(chalk.whiteBright(`System: `), chalk.yellowBright(platform));
    console.log(chalk.whiteBright(`Branch: `), chalk.yellowBright(branch));
    const isQa = branch.startsWith("qa");

    const SERVER_CDN_ADDRESS = isQa ? "qa-cdn.altmp.workers.dev" : CDN_ADDRESS;
    const serverBranch = branch;

    let headers = undefined;

    if (isQa) {
        branch = "dev";
        console.log(chalk.yellowBright('===== QA branches require additional authorization! ====='))

        try {
            const code = await authorizeDiscord();
            const token = await authorizeCDN(code);
            headers = { 'X-Auth': token }
        } catch (e) {
            console.error(chalk.redBright(`Failed to authorize: ${e}`));
            return;
        }
    }

    const sharedFiles = {};
    let res = await axios.get(`https://${CDN_ADDRESS}/data/${branch}/update.json`, { responseType: 'json', headers });
    for ([file, hash] of Object.entries(res.data.hashList)) {
        sharedFiles[file] = `https://${CDN_ADDRESS}/data/${branch}/${file}`;
    }

    const linuxFiles = {
        ...sharedFiles,
        'modules/libjs-module.so': `https://${CDN_ADDRESS}/js-module/${branch}/${platform}/modules/js-module/libjs-module.so`,
        'libnode.so.108': `https://${CDN_ADDRESS}/js-module/${branch}/${platform}/modules/js-module/libnode.so.108`,
        'start.sh': `https://${CDN_ADDRESS}/others/start.sh`,
    };

    res = await axios.get(`https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_linux/update.json`, { responseType: 'json', headers });
    for ([file, hash] of Object.entries(res.data.hashList)) {
        linuxFiles[file] = `https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_linux/${file}`;
    }

    const windowsFiles = {
        ...sharedFiles,
        'modules/js-module.dll': `https://${CDN_ADDRESS}/js-module/${branch}/${platform}/modules/js-module/js-module.dll`,
        'libnode.dll': `https://${CDN_ADDRESS}/js-module/${branch}/${platform}/modules/js-module/libnode.dll`,
    };

    res = await axios.get(`https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_win32/update.json`, { responseType: 'json', headers });
    for ([file, hash] of Object.entries(res.data.hashList)) {
        windowsFiles[file] = `https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_win32/${file}`;
    }

    const sharedUpdates = [
        `https://${CDN_ADDRESS}/data/${branch}/update.json`,
    ];

    const linuxUpdates = [
        ...sharedUpdates,
        `https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_linux/update.json`,
        `https://${CDN_ADDRESS}/js-module/${branch}/x64_linux/update.json`,
    ];

    const windowsUpdates = [
        ...sharedUpdates,
        `https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_win32/update.json`,
        `https://${CDN_ADDRESS}/js-module/${branch}/x64_win32/update.json`,
    ];

    if (loadBytecodeModule) {
        res = await axios.get(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_linux/update.json`, { responseType: 'json', headers });
        for ([file, hash] of Object.entries(res.data.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_linux/${file}`;
        }

        res = await axios.get(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_win32/update.json`, { responseType: 'json', headers });
        for ([file, hash] of Object.entries(res.data.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_linux/update.json`)
        windowsUpdates.push(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_win32/update.json`);
    }

    if (loadCSharpModule) {
        res = await axios.get(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_linux/update.json`, { responseType: 'json', headers });
        for ([file, hash] of Object.entries(res.data.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_linux/${file}`;
        }

        res = await axios.get(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_win32/update.json`, { responseType: 'json', headers });
        for ([file, hash] of Object.entries(res.data.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_win32/update.json`);
    }

    if (loadJSV2Module) {
        if (branch != 'dev') {
            console.log(chalk.redBright('===== JS V2 module is only available in dev currently, skipping ====='));
        } else {
            res = await axios.get(`https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_linux/update.json`, { responseType: 'json', headers });
            for ([file, hash] of Object.entries(res.data.hashList)) {
                linuxFiles[file] = `https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_linux/${file}`;
            }

            res = await axios.get(`https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_win32/update.json`, { responseType: 'json', headers });
            for ([file, hash] of Object.entries(res.data.hashList)) {
                windowsFiles[file] = `https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_win32/${file}`;
            }

            linuxUpdates.push(`https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_linux/update.json`);
            windowsUpdates.push(`https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_win32/update.json`);
        }


    }

    const [filesUpdate, filesToUse] = (platform == 'x64_win32')
        ? [windowsUpdates, windowsFiles]
        : [linuxUpdates, linuxFiles];

    if (!fs.existsSync(path.join(rootPath, 'data'))) {
        fs.mkdirSync(path.join(rootPath, 'data'));
    }

    if (!fs.existsSync(path.join(rootPath, 'modules'))) {
        fs.mkdirSync(path.join(rootPath, 'modules'));
    }

    console.log(chalk.greenBright('===== Checking file hashes ====='));

    let filesToDownload = {};

    let promises = [];
    let anyHashRejected = false;
    for (const url of filesUpdate) {
        const promise = new Promise((resolve, reject) => {
            axios.get(url, { responseType: 'json', headers }).then(({ data: {
                hashList
            } }) => {
                for (let [file, hash] of Object.entries(hashList)) {
                    file = correctPathIfNecessary(file);

                    if (getLocalFileHash(file) === hash) {
                        console.log(chalk.cyanBright('✓'), chalk.whiteBright(file));
                        continue;
                    }

                    console.log(chalk.redBright('x'), chalk.whiteBright(file));

                    if (anyHashRejected) return;
                    filesToDownload[file] = filesToUse[file];
                }

                resolve();
            }).catch(error => {
                reject();

                if (anyHashRejected) return;
                anyHashRejected = true;
                console.error(chalk.redBright(`Failed to check hash ${url}: ${error}`));
            });
        });

        promises.push(promise);
    }

    try {
        await Promise.all(promises);
        console.log(chalk.greenBright('===== File hash check complete ====='));
    }
    catch {
        console.log(chalk.redBright('===== File hash check corrupted -> download all ====='));
        filesToDownload = filesToUse;
    }

    const shouldIncludeRuntimeConfig = !fs.existsSync('AltV.Net.Host.runtimeconfig.json') && loadCSharpModule;

    if (Object.keys(filesToDownload).length) {
        promises = [];
        console.log(chalk.greenBright('===== Download ====='));
        for (const [file, url] of Object.entries(filesToDownload)) {
            // Avoid overwriting existing runtimeconfig.json file
            if (file == "AltV.Net.Host.runtimeconfig.json" && !shouldIncludeRuntimeConfig)
                continue;

            console.log(chalk.whiteBright(`${file}`));
            const promise = new Promise((resolve) => {
                axios.get(url, { responseType: 'arraybuffer', headers }).then(response => {
                    fs.writeFileSync(path.join(rootPath, file), response.data);
                    resolve();
                }).catch(error => {
                    console.error(chalk.redBright(`Failed to download ${url}: ${error}`));
                    if (file.includes('.bin')) {
                        console.log(`File may only be available in another branch. Can be safely ignored`)
                    }
                    resolve();
                });
            });

            promises.push(promise);
        }

        await Promise.all(promises);
    }

    console.log(chalk.greenBright('===== Complete ====='));
}

function getLocalFileHash(file) {
    let fileBuffer;
    try {
        fileBuffer = fs.readFileSync(path.join(rootPath, file));
    } catch {
        return '_';
    }
    return crypto.createHash('sha1').update(fileBuffer).digest('hex');
}

// I dont't know why altv-pkg has different file paths than alt:V cdn
const pathsCorrects = {
    'modules/js-module/js-module.dll': 'modules/js-module.dll',
    'modules/js-module/libnode.dll': 'libnode.dll',
    'modules/js-module/libjs-module.so': 'modules/libjs-module.so',
    'modules/js-module/libnode.so.108': 'libnode.so.108',
};

function correctPathIfNecessary(file) {
    return pathsCorrects[file] ?? file;
}

function loadRuntimeConfig() {
    let loadBytecodeModule = false;
    let loadCSharpModule = false;
    let loadJSV2Module = false;

    try {
        const data = fs.readFileSync(`./${RC_FILE_NAME}`, { encoding: 'utf8' });
        const parsedData = JSON.parse(data);

        loadBytecodeModule = !!parsedData.loadBytecodeModule;
        loadCSharpModule = !!parsedData.loadCSharpModule;
        loadJSV2Module = !!parsedData.loadJSV2Module;
    } catch (e) {
        console.log(chalk.gray(`Configuration file '${RC_FILE_NAME}' could not be read. Continuing without...`));
    }

    return { loadBytecodeModule, loadCSharpModule, loadJSV2Module };
}

start();
