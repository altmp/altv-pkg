#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const crypto = require('crypto');

const RC_FILE_NAME = ".altvpkgrc.json";
const CDN_ADDRESS = "cdn.alt-mp.com";

const args = process.argv;
const platform = process.platform == 'win32' ? 'x64_win32' : 'x64_linux';
const rootPath = process.cwd();

let branch = null;
const { loadBytecodeModule, loadCSharpModule } = loadRuntimeConfig();

for (let i = 0; i < args.length; i++) {
    if (args[i] === 'release') {
        branch = 'release';
        break;
    }

    if (args[i] === 'rc') {
        branch = 'rc';
        break;
    }

    if (args[i] === 'dev') {
        branch = 'dev';
        break;
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

    const sharedFiles = {
        'data/vehmodels.bin': `https://${CDN_ADDRESS}/data/${branch}/data/vehmodels.bin`,
        'data/vehmods.bin': `https://${CDN_ADDRESS}/data/${branch}/data/vehmods.bin`,
        'data/clothes.bin': `https://${CDN_ADDRESS}/data/${branch}/data/clothes.bin`,
        'data/pedmodels.bin': `https://${CDN_ADDRESS}/data/${branch}/data/pedmodels.bin`,
        'data/rpfdata.bin': `https://${CDN_ADDRESS}/data/${branch}/data/rpfdata.bin`,
    };

    const linuxFiles = {
        ...sharedFiles,
        'modules/libjs-module.so': `https://${CDN_ADDRESS}/js-module/${branch}/${platform}/modules/js-module/libjs-module.so`,
        'libnode.so.108': `https://${CDN_ADDRESS}/js-module/${branch}/${platform}/modules/js-module/libnode.so.108`,
        'start.sh': `https://${CDN_ADDRESS}/others/start.sh`,
        'altv-server': `https://${CDN_ADDRESS}/server/${branch}/x64_linux/altv-server`,
    };

    const windowsFiles = {
        ...sharedFiles,
        'modules/js-module.dll': `https://${CDN_ADDRESS}/js-module/${branch}/${platform}/modules/js-module/js-module.dll`,
        'libnode.dll': `https://${CDN_ADDRESS}/js-module/${branch}/${platform}/modules/js-module/libnode.dll`,
        'altv-server.exe': `https://${CDN_ADDRESS}/server/${branch}/${platform}/altv-server.exe`,
    };

    const sharedUpdates = [
        `https://${CDN_ADDRESS}/data/${branch}/update.json`,
    ];

    const linuxUpdates = [
        ...sharedUpdates,
        `https://${CDN_ADDRESS}/server/${branch}/x64_linux/update.json`,
        `https://${CDN_ADDRESS}/js-module/${branch}/x64_linux/update.json`,
    ];

    const windowsUpdates = [
        ...sharedUpdates,
        `https://${CDN_ADDRESS}/server/${branch}/x64_win32/update.json`,
        `https://${CDN_ADDRESS}/js-module/${branch}/x64_win32/update.json`,
    ];

    if (loadBytecodeModule) {
        linuxFiles['modules/libjs-bytecode-module.so'] = `https://${CDN_ADDRESS}/js-bytecode-module/${branch}/${platform}/modules/libjs-bytecode-module.so`;
        windowsFiles['modules/js-bytecode-module.dll'] = `https://${CDN_ADDRESS}/js-bytecode-module/${branch}/${platform}/modules/js-bytecode-module.dll`;

        linuxUpdates.push(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_linux/update.json`)
        windowsUpdates.push(`https://${CDN_ADDRESS}/js-bytecode-module/${branch}/x64_win32/update.json`);
    }

    if (loadCSharpModule) {

        linuxFiles['AltV.Net.Host.dll'] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/${platform}/AltV.Net.Host.dll`;
        linuxFiles['AltV.Net.Host.runtimeconfig.json'] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/${platform}/AltV.Net.Host.runtimeconfig.json`;

        linuxFiles['modules/libcsharp-module.so'] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/${platform}/modules/libcsharp-module.so`;

        windowsFiles['AltV.Net.Host.dll'] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/${platform}/AltV.Net.Host.dll`;
        windowsFiles['AltV.Net.Host.runtimeconfig.json'] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/${platform}/AltV.Net.Host.runtimeconfig.json`;

        windowsFiles['modules/csharp-module.dll'] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/${platform}/modules/csharp-module.dll`;
        windowsFiles['modules/csharp-module.pdb'] = `https://${CDN_ADDRESS}/coreclr-module/${branch}/${platform}/modules/csharp-module.pdb`;

        linuxUpdates.push(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_linux/update.json`);
        windowsUpdates.push(`https://${CDN_ADDRESS}/coreclr-module/${branch}/x64_win32/update.json`);
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
            axios.get(url, { responseType: 'json' }).then(({ data: {
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
                axios.get(url, { responseType: 'arraybuffer' }).then(response => {
                    fs.writeFileSync(path.join(rootPath, file), response.data);
                    resolve();
                }).catch(error => {
                    console.error(chalk.redBright(`Failed to download ${file}: ${error}`));
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

    try {
        const data = fs.readFileSync(`./${RC_FILE_NAME}`, { encoding: 'utf8' });
        const parsedData = JSON.parse(data);

        loadBytecodeModule = !!parsedData.loadBytecodeModule;
        loadCSharpModule = !!parsedData.loadCSharpModule;
    } catch (e) {
        console.log(chalk.gray(`Configuration file '${RC_FILE_NAME}' could not be read. Continuing without...`));
    }

    return { loadBytecodeModule, loadCSharpModule };
}

start();
