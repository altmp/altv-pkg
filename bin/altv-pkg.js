#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

const args = process.argv
const platform = process.platform == 'win32' ? 'x64_win32' : 'x64_linux';
const rootPath = process.cwd();

let branch = null;



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
    process.exit(0)
}

async function start() {
    console.log(chalk.greenBright('===== altv-pkg ====='));
    console.log(chalk.whiteBright(`System: `), chalk.yellowBright(platform));
    console.log(chalk.whiteBright(`Branch: `), chalk.yellowBright(branch));

    const linuxFiles = {
        'data/vehmodels.bin': `https://cdn.altv.mp/data/${branch}/data/vehmodels.bin`,
        'data/vehmods.bin': `https://cdn.altv.mp/data/${branch}/data/vehmods.bin`,
        'data/clothes.bin': `https://cdn.altv.mp/data/${branch}/data/clothes.bin`,
        'modules/libjs-module.so': `https://cdn.altv.mp/js-module/${branch}/${platform}/modules/js-module/libjs-module.so`,
        'libnode.so.102': `https://cdn.altv.mp/js-module/${branch}/${platform}/modules/js-module/libnode.so.102`,
        'start.sh': `https://cdn.altv.mp/others/start.sh`,
        'altv-server': `https://cdn.altv.mp/server/${branch}/x64_linux/altv-server`,
    }

    const windowsFiles = {
        'data/vehmodels.bin': `https://cdn.altv.mp/data/${branch}/data/vehmodels.bin`,
        'data/vehmods.bin': `https://cdn.altv.mp/data/${branch}/data/vehmods.bin`,
        'data/clothes.bin': `https://cdn.altv.mp/data/${branch}/data/clothes.bin`,
        'modules/js-module.dll': `https://cdn.altv.mp/js-module/${branch}/${platform}/modules/js-module/js-module.dll`,
        'libnode.dll': `https://cdn.altv.mp/js-module/${branch}/${platform}/modules/js-module/libnode.dll`,
        'altv-server.exe': `https://cdn.altv.mp/server/${branch}/${platform}/altv-server.exe`,
    };

    const filesToUse = platform == 'x64_win32' ? windowsFiles : linuxFiles;

    if (!fs.existsSync(path.join(rootPath, 'data'))) {
        fs.mkdirSync(path.join(rootPath, 'data'));
    }

    if (!fs.existsSync(path.join(rootPath, 'modules'))) {
        fs.mkdirSync(path.join(rootPath, 'modules'));
    }

    let promises = [];
    console.log(chalk.greenBright('===== Download ====='));
    for (const [file, url] of Object.entries(filesToUse)) {
        console.log(chalk.whiteBright(`${file}`))
        const promise = new Promise((resolve) => {
            axios.get(url, { responseType: 'arraybuffer' }).then(response => {
                fs.writeFileSync(path.join(rootPath, file), response.data);
                resolve();
            }).catch(error => {
                console.error(`Failed to download ${file}: ${error}`);
                resolve();
            });
        });

        promises.push(promise);
    }

    await Promise.all(promises);
    console.log(chalk.greenBright('===== Complete ====='));
}

start();
