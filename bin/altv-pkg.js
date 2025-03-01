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

const ALTV_PREFIX = "ALTV-";
const BRANCH_RELEASE = "release";
const BRANCH_RC = "rc";
const BRANCH_DEV = "dev";

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
    if (args[i] === BRANCH_RELEASE) {
        branch = BRANCH_RELEASE;
        continue;
    }

    if (args[i] === BRANCH_RC) {
        branch = BRANCH_RC;
        continue;
    }

    if (args[i] === BRANCH_DEV) {
        branch = BRANCH_DEV;
        continue;
    }

    if (args[i].startsWith(ALTV_PREFIX)) {
        branch = args[i];
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
    branch = BRANCH_RELEASE;
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

async function getFilesFromCDN(urlPrefix, branch, platform, file, headers) {
    files = {};
    fullUrl = `${urlPrefix}/${branch}/${platform}/${file}`;

    res = await fetchJsonData(fullUrl, {
        responseType: 'application/json',
        headers,
    });
    for ([tmpFile, hash] of Object.entries(res.hashList)) {
        files[tmpFile] = `${urlPrefix}/${branch}/${platform}/${tmpFile}`;
    }
    return files;
}

async function start() {
    console.log(chalk.greenBright('===== altv-pkg ====='));
    console.log(chalk.whiteBright(`System: `), chalk.yellowBright(platform));
    console.log(chalk.whiteBright(`Branch: `), chalk.yellowBright(branch));

    let headers = undefined;
    let downloadDataBranch = (branch.startsWith(ALTV_PREFIX)) ? BRANCH_DEV : branch;

    clearOldModulesStructure();

    const sharedFiles = {};
    let res = await fetchJsonData(`https://${CDN_ADDRESS}/data/${downloadDataBranch}/update.json`, {
        responseType: 'application/json',
        headers,
    });

    for ([file, hash] of Object.entries(res.hashList)) {
        sharedFiles[file] = `https://${CDN_ADDRESS}/data/${downloadDataBranch}/${file}`;
    }

    const linuxFiles = { ...sharedFiles };

    res = await fetchJsonData(`https://${CDN_ADDRESS}/server/${branch}/x64_linux/update.json`, {
        responseType: 'application/json',
        headers,
    });

    if (!res) return;

    for ([file, hash] of Object.entries(res.hashList)) {
        linuxFiles[file] = `https://${CDN_ADDRESS}/server/${branch}/x64_linux/${file}`;
    }

    const windowsFiles = { ...sharedFiles };

    res = await fetchJsonData(`https://${CDN_ADDRESS}/server/${branch}/x64_win32/update.json`, {
        responseType: 'application/json',
        headers,
    });
    for ([file, hash] of Object.entries(res.hashList)) {
        windowsFiles[file] = `https://${CDN_ADDRESS}/server/${branch}/x64_win32/${file}`;
    }

    const sharedUpdates = [`https://${CDN_ADDRESS}/data/${downloadDataBranch}/update.json`];

    const linuxUpdates = [
        ...sharedUpdates,
        `https://${CDN_ADDRESS}/server/${branch}/x64_linux/update.json`,
    ];

    const windowsUpdates = [
        ...sharedUpdates,
        `https://${CDN_ADDRESS}/server/${branch}/x64_win32/update.json`,
    ];

    if (loadJSModule) {
        let jsModulesBranch = branch;
        try
        {
            tmpfiles = await getFilesFromCDN(`https://${CDN_ADDRESS}/js-module`, jsModulesBranch, `x64_linux`, `update.json`, headers)
        } catch (error)
        {
            console.log(chalk.yellowBright('Unable to get files from ${branch}.'));
            console.log(chalk.yellowBright('Will try to use ${downloadDataBranch}...'));
            jsModulesBranch = downloadDataBranch;
            tmpfiles = await getFilesFromCDN(`https://${CDN_ADDRESS}/js-module`, jsModulesBranch, `x64_linux`, `update.json`, headers)
        }
        for ([file, hash] of Object.entries(tmpfiles)) {
            linuxFiles[file] = hash;
        }
        linuxUpdates.push(`https://${CDN_ADDRESS}/js-module/${jsModulesBranch}/x64_linux/update.json`);
        
        jsModulesBranch = branch;
        try
        {
            tmpfiles = await getFilesFromCDN(`https://${CDN_ADDRESS}/js-module`, jsModulesBranch, `x64_win32`, `update.json`, headers)
        } catch (error)
        {
            console.log(chalk.yellowBright('Unable to get files from ${branch}.'));
            console.log(chalk.yellowBright('Will try to use ${downloadDataBranch}...'));
            jsModulesBranch = downloadDataBranch;
            tmpfiles = await getFilesFromCDN(`https://${CDN_ADDRESS}/js-module`, jsModulesBranch, `x64_win32`, `update.json`, headers)
        }
        for ([file, hash] of Object.entries(tmpfiles)) {
            windowsFiles[file] = hash;
        }
        windowsUpdates.push(`https://${CDN_ADDRESS}/js-module/${jsModulesBranch}/x64_win32/update.json`);
    }

    if (loadBytecodeModule) {
        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-bytecode-module/${downloadDataBranch}/x64_linux/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/js-bytecode-module/${downloadDataBranch}/x64_linux/${file}`;
        }

        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-bytecode-module/${downloadDataBranch}/x64_win32/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/js-bytecode-module/${downloadDataBranch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/js-bytecode-module/${downloadDataBranch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/js-bytecode-module/${downloadDataBranch}/x64_win32/update.json`);
    }

    if (loadCSharpModule) {
        res = await fetchJsonData(`https://${CDN_ADDRESS}/coreclr-module/${downloadDataBranch}/x64_linux/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/coreclr-module/${downloadDataBranch}/x64_linux/${file}`;
        }

        res = await fetchJsonData(`https://${CDN_ADDRESS}/coreclr-module/${downloadDataBranch}/x64_win32/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/coreclr-module/${downloadDataBranch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/coreclr-module/${downloadDataBranch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/coreclr-module/${downloadDataBranch}/x64_win32/update.json`);
    }

    if (loadJSV2Module) {
        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-module-v2/${downloadDataBranch}/x64_linux/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            linuxFiles[file] = `https://${CDN_ADDRESS}/js-module-v2/${downloadDataBranch}/x64_linux/${file}`;
        }

        res = await fetchJsonData(`https://${CDN_ADDRESS}/js-module-v2/${downloadDataBranch}/x64_win32/update.json`, {
            responseType: 'application/json',
            headers,
        });
        for ([file, hash] of Object.entries(res.hashList)) {
            windowsFiles[file] = `https://${CDN_ADDRESS}/js-module-v2/${downloadDataBranch}/x64_win32/${file}`;
        }

        linuxUpdates.push(`https://${CDN_ADDRESS}/js-module-v2/${downloadDataBranch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/js-module-v2/${downloadDataBranch}/x64_win32/update.json`);
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

    const shouldIncludeRuntimeConfig = !fs.existsSync(path.join(rootPath, 'modules/csharp-module/AltV.Net.Host.runtimeconfig.json')) && loadCSharpModule;

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
                // Avoid overwriting existing runtimeconfig.json file
                if (file == 'modules/csharp-module/AltV.Net.Host.runtimeconfig.json' && !shouldIncludeRuntimeConfig) {
                    continue;
                }
                
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

    if (Object.keys(filesToDownload).length) {
        promises = [];
        console.log(chalk.greenBright('===== Downloading ====='));
        for (const [file, url] of Object.entries(filesToDownload)) {
            // Avoid overwriting existing runtimeconfig.json file
            if (file == 'modules/csharp-module/AltV.Net.Host.runtimeconfig.json' && !shouldIncludeRuntimeConfig) {
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

function clearOldModulesStructure() {
    const oldModuleFiles = [
        "AltV.Net.Host.runtimeconfig.json",
        "AltV.Net.Host.dll",
        //"libnode.so.108",
        //"libnode.dll",
        //"libnodev2.so",
        //"libnodev2.dll",
        //"modules/libnode.so.108",
        //"modules/libnode.dll",
        //"modules/libnodev2.so",
        "modules/csharp-module.dll",
        "modules/libcsharp-module.so",
        //"modules/libnodev2.dll",
        //"modules/js-bytecode-module.dll",
        //"modules/libjs-bytecode-module.so",
        //"modules/js-module-v2.dll",
        //"modules/libjs-module-v2.so",
        //"modules/js-module.dll",
        //"modules/libjs-module.so",
    ];

    oldModuleFiles.forEach(element => {
        if (fs.existsSync(path.join(rootPath, element))) {
            fs.unlinkSync(path.join(rootPath, element));
        }
    });
}

start();
