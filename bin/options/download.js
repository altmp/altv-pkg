const { logDanger, logNormal } = require('../services/logging');
const { exec } = require('child_process');
const { existsSync, copyFileSync, mkdirSync } = require('fs');
const download = require('download');
const path = require('path');
const { askQuestion } = require('../services/question');
const validBranches = ['release', 'rc', 'dev'];
const platform = process.platform === 'win32' ? 'windows' : 'linux';
const downloadURLS = {
    windows: [
        {
            url: `https://cdn.altv.mp/js-module/%_%/x64_win32/update.json`,
            destination: '.',
        },
        {
            url: `https://cdn.altv.mp/js-module/%_%/x64_win32/modules/js-module/js-module.dll`,
            destination: './modules',
        },
        {
            url: `https://cdn.altv.mp/js-module/%_%/x64_win32/modules/js-module/libnode.dll`,
            destination: '.',
        },
        {
            url: `https://cdn.altv.mp/server/%_%/x64_win32/altv-server.exe`,
            destination: '.',
        },
        {
            url: `https://cdn.altv.mp/server/%_%/x64_win32/data/vehmodels.bin`,
            destination: './data',
        },
        {
            url: `https://cdn.altv.mp/server/%_%/x64_win32/data/vehmods.bin`,
            destination: './data',
        },
    ],
    linux: [
        {
            url: `https://cdn.altv.mp/js-module/%_%/x64_linux/update.json`,
            destination: '.',
        },
        {
            url: `https://cdn.altv.mp/js-module/%_%/x64_linux/modules/js-module/libjs-module.so`,
            destination: './modules',
        },
        {
            url: `https://cdn.altv.mp/js-module/%_%/x64_linux/modules/js-module/libnode.so.72`,
            destination: '.',
        },
        {
            url: `https://cdn.altv.mp/server/%_%/x64_linux/altv-server`,
            destination: '.',
        },
        {
            url: `https://cdn.altv.mp/server/%_%/x64_linux/data/vehmodels.bin`,
            destination: './data',
        },
        {
            url: `https://cdn.altv.mp/server/%_%/x64_linux/data/vehmods.bin`,
            destination: './data',
        },
        {
            url: `https://cdn.altv.mp/others/start.sh`,
            destination: '.',
        },
    ],
};

console.log(`PATH IS: ${__dirname}`);

async function downloadAll(urls) {
    return new Promise(async (resolve) => {
        for (let i = 0; i < urls.length; i++) {
            console.log(urls[i].url);
            await download(urls[i].url, urls[i].destination).catch((err) => {
                throw err;
            });
            console.log(`\r\n[${i + 1}/${urls.length}] Complete`);
        }

        resolve();
    });
}

async function handleDownload(branch) {
    if (!branch) {
        branch = 'release';
    } else {
        branch = branch.toLowerCase();
    }

    let valid = false;

    for (let i = 0; i < validBranches.length; i++) {
        if (validBranches[i] === branch) {
            valid = true;
            break;
        }
    }

    if (!valid) {
        logDanger(`Invalid Branch. Try: 'release', 'rc', or 'dev'`);
        return;
    }

    logNormal(`You have selected branch ${branch} for ${platform}.`);
    downloadURLS[platform].forEach((entry) => {
        entry.url = entry.url.replace(`%_%`, branch);
    });

    await downloadAll(downloadURLS[platform]);

    const serverPath = path.join('./', 'server.cfg');
    if (!existsSync(serverPath)) {
        const response = await askQuestion(`Using voice? [y/N]`);
        if (!response || response.includes('n')) {
            const configFilePath = path.join(__dirname, '../files/server.cfg');
            copyFileSync(configFilePath, serverPath);
        } else {
            const configFilePath = path.join(__dirname, '../files/server-voice.cfg');
            copyFileSync(configFilePath, serverPath);
        }
    }

    const packagePath = path.join('./', 'package.json');
    if (!existsSync(packagePath)) {
        copyFileSync(path.join(__dirname, '../files/package.json.ref'), packagePath);
        exec(`npm install`);
        exec(`npm i -D @altv/types-client @altv/types-server @altv/types-natives @altv/types-webview`);
    }

    const resourcesPath = path.join('./', 'resources');
    if (!existsSync(resourcesPath)) {
        mkdirSync(resourcesPath);
        const response = await askQuestion(`Generate example resource? [y/N]`);
        if (response && response.includes('y')) {
            const examplePath = path.join('./resources', 'example');
            const clientResPath = path.join(examplePath, 'client');
            const serverResPath = path.join(examplePath, 'server');

            const clientStartupPath = path.join(__dirname, '../files/client.js.ref');
            const clientStartupFile = path.join(clientResPath, 'startup.js');

            const serverStartupPath = path.join(__dirname, '../files/server.js.ref');
            const serverStartupFile = path.join(serverResPath, 'startup.js');

            const resourcePath = path.join(__dirname, '../files/resource.cfg.ref');
            const resourceFile = path.join(examplePath, 'resource.cfg');

            try {
                if (!existsSync(examplePath)) {
                    mkdirSync(examplePath);
                    mkdirSync(clientResPath);
                    mkdirSync(serverResPath);
                }

                copyFileSync(clientStartupPath, clientStartupFile);
                copyFileSync(serverStartupPath, serverStartupFile);
                copyFileSync(resourcePath, resourceFile);
                logNormal(`Generated 'example' resource. Add 'example' to your 'server.cfg' to load it.`);
            } catch (err) {
                console.log(err);
                logDanger(`Failed to generate example resource. Moving on...`, false);
            }
        }
    }

    if (platform !== 'windows') {
        exec('chmod +x ./start.sh', (err) => {
            if (err) {
                console.log(err);
                return;
            }
        });

        exec('chmod +x ./altv-server', (err) => {
            if (err) {
                console.log(err);
                return;
            }
        });

        logNormal(`Use: './start.sh' to start your server!`);
    } else {
        logNormal(`Use: 'altv-server.exe' to start your server! Powershell: './altv-server.exe'`);
    }

    process.exit(0);
}

module.exports = {
    handleDownload,
};
