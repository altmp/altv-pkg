#!/usr/bin/env node
const crypto = require('crypto');
const RPC = require('discord-rpc');
const chalk = require('chalk');

const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const RC_FILE_NAME = '.altvpkgrc.json';
const CDN_ADDRESS = 'cdn.alt-mp.com';
const DISCORD_ID = '580868196270342175';

const args = process.argv;
const rootPath = process.cwd();

let platform = process.platform == 'win32' ? 'x64_win32' : 'x64_linux';
let branch = null;

const { loadJSModule, loadBytecodeModule, loadCSharpModule, loadJSV2Module, loadVoiceServer } = loadRuntimeConfig();

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
                        prompt: 'none',
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
        const res = await fetchJsonData('https://qa-auth.alt-mp.com/auth', {
            responseType: 'application/json',
            headers: { Authorization: code },
        });

        return res?.token;
    } catch (e) {
        if (e?.response?.status != 403) throw e;
        throw new Error('You do not have permissions to access this branch');
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

    if (args[i].startsWith('qa')) {
        branch = args[i];
        continue;
    }

    if (args[i] === 'windows') {
        platform = 'x64_win32';
        continue;
    }

    if (args[i] === 'linux') {
        platform = 'x64_linux';
        continue;
    }
}

if (!branch) {
    branch = 'release';
    console.log(chalk.yellowBright('Branch not specified, using release'));
}

/**
 * Fetch JSON data and return an object
 *
 * @param {string} url
 * @param {Object} headers
 * @return {Promise<Object>}
 */
async function fetchJsonData(url, headers) {
    const response = await fetch(url, headers).catch((err) => {
        throw err;
    });

    if (!response || !response.ok) {
        throw new Error('Failed to download latest')
    }

    return response.json();
}

async function start() {
    console.log(chalk.greenBright('===== altv-pkg ====='));
    console.log(chalk.whiteBright(`System: `), chalk.yellowBright(platform));
    console.log(chalk.whiteBright(`Branch: `), chalk.yellowBright(branch));
    const isQa = branch.startsWith('qa');

    const SERVER_CDN_ADDRESS = isQa ? 'qa-cdn.altmp.workers.dev' : CDN_ADDRESS;
    const serverBranch = branch;

    let headers = undefined;

    if (isQa) {
        branch = 'dev';
        console.log(chalk.yellowBright('===== QA branches require additional authorization! ====='));

        try {
            const code = await authorizeDiscord();
            const token = await authorizeCDN(code);
            headers = { 'X-Auth': token };
        } catch (e) {
            console.error(chalk.redBright(`Failed to authorize: ${e}`));
            return;
        }
    }

    const sharedFiles = {};
    let res = await fetchJsonData(`https://${CDN_ADDRESS}/data/${branch}/update.json`, {
        responseType: 'application/json',
        headers,
    });

    for ([file, hash] of Object.entries(res.hashList)) {
        sharedFiles[file] = `https://${CDN_ADDRESS}/data/${branch}/${file}`;
    }

    const linuxFiles = {
        ...sharedFiles,
        'start.sh': `https://${CDN_ADDRESS}/others/start.sh`,
    };

    res = await fetchJsonData(`https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_linux/update.json`, {
        responseType: 'application/json',
        headers,
    });

    if (!res) return;

    for ([file, hash] of Object.entries(res.hashList)) {
        linuxFiles[file] = `https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_linux/${file}`;
    }

    const windowsFiles = { ...sharedFiles };

    res = await fetchJsonData(`https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_win32/update.json`, {
        responseType: 'application/json',
        headers,
    });
    for ([file, hash] of Object.entries(res.hashList)) {
        windowsFiles[file] = `https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_win32/${file}`;
    }

    const sharedUpdates = [`https://${CDN_ADDRESS}/data/${branch}/update.json`];

    const linuxUpdates = [
        ...sharedUpdates,
        `https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_linux/update.json`,
    ];

    const windowsUpdates = [
        ...sharedUpdates,
        `https://${SERVER_CDN_ADDRESS}/server/${serverBranch}/x64_win32/update.json`,
    ];

    if (loadJSModule) {
        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-module/${branch}/x64_linux/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/js-module/${branch}/x64_linux/${file}`;
        }

        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-module/${branch}/x64_win32/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/js-module/${branch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/js-module/${branch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/js-module/${branch}/x64_win32/update.json`);
    }

    if (loadBytecodeModule) {
        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_linux/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_linux/${file}`;
        }

        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_win32/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_win32/update.json`);
    }

    if (loadCSharpModule) {
        res = await fetchJsonData(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_linux/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_linux/${file}`;
        }

        res = await fetchJsonData(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_win32/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_win32/update.json`);
    }

    if (loadJSV2Module) {
        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_linux/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_linux/${file}`;
        }

        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_win32/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/js-module-v2/${branch}/x64_win32/update.json`);
    }

    if (loadVoiceServer) {
        res = await fetchJsonData(`https://${CDN_ADDRESS}/voice-server/${branch}/x64_linux/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/voice-server/${branch}/x64_linux/${file}`;
        }

        res = await fetchJsonData(`https://${CDN_ADDRESS}/voice-server/${branch}/x64_win32/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/voice-server/${branch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/voice-server/${branch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/voice-server/${branch}/x64_win32/update.json`);
    }

    const [filesUpdate, filesToUse] =
        platform == 'x64_win32' ? [windowsUpdates, windowsFiles] : [linuxUpdates, linuxFiles];

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
        const promise = new Promise(async (resolve, reject) => {
            /** @type {{ hashList: { [key: string]: string }}} */
            const data = await fetchJsonData(url, { responseType: 'application/json', headers });

            if (!data) {
                console.error(chalk.redBright(`Failed to check hash ${url}: ${error}`));
                reject();
                return;
            }

            for (let [file, hash] of Object.entries(data.hashList)) {
                if (getLocalFileHash(file) === hash) {
                    console.log(chalk.cyanBright('✓'), chalk.whiteBright(file));
                    continue;
                }

                console.log(chalk.redBright('x'), chalk.whiteBright(file));

                if (anyHashRejected) {
                    return;
                }

                filesToDownload[file] = filesToUse[file];
            }

            resolve();
        });

        promises.push(promise);
    }

    try {
        await Promise.all(promises);
        console.log(chalk.greenBright('===== File hash check complete ====='));
    } catch {
        console.log(chalk.redBright('===== File hash check corrupted -> download all ====='));
        filesToDownload = filesToUse;
    }

    const shouldIncludeRuntimeConfig = !fs.existsSync('AltV.Net.Host.runtimeconfig.json') && loadCSharpModule;

    if (Object.keys(filesToDownload).length) {
        promises = [];
        console.log(chalk.greenBright('===== Downloading ====='));
        for (const [file, url] of Object.entries(filesToDownload)) {
            // Avoid overwriting existing runtimeconfig.json file
            if (file == 'AltV.Net.Host.runtimeconfig.json' && !shouldIncludeRuntimeConfig) {
                continue;
            }

            console.log(chalk.whiteBright(`${file}`));
            const promise = new Promise(async (resolve) => {
                const response = await fetch(url, { headers }).catch((err) => {
                    return undefined;
                });

                if (!response || !response.ok) {
                    return resolve();
                }

                const body = Readable.fromWeb(response.body);
                
                const fullPath = path.join(rootPath, file);
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });

                const writeStream = fs.createWriteStream(fullPath);
                body.pipe(writeStream);
                body.on('close', () => {
                    resolve();
                });

                body.on('error', (err) => {
                    console.log(err);
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

function loadRuntimeConfig() {
    let loadJSModule = true;

    let loadBytecodeModule = false;
    let loadCSharpModule = false;
    let loadJSV2Module = false;
    let loadVoiceServer = false;

    try {
        const data = fs.readFileSync(`./${RC_FILE_NAME}`, { encoding: 'utf8' });
        const parsedData = JSON.parse(data);

        if (typeof parsedData.loadJSModule !== 'undefined') {
            loadJSModule = !!parsedData.loadJSModule;
        }

        loadBytecodeModule = !!parsedData.loadBytecodeModule;
        loadCSharpModule = !!parsedData.loadCSharpModule;
        loadJSV2Module = !!parsedData.loadJSV2Module;
        loadVoiceServer = !!parsedData.loadVoiceServer;
    } catch (e) {
        console.log(chalk.gray(`Configuration file '${RC_FILE_NAME}' could not be read. Continuing without...`));
    }

    return { loadJSModule, loadBytecodeModule, loadCSharpModule, loadJSV2Module, loadVoiceServer };
}

start();
