#!/usr/bin/env node
const yargs = require('yargs/yargs')();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

const platform = process.platform == 'win32' ? 'x64_win32' : 'x64_linux';
const rootPath = process.cwd();

let branch = 'release'

yargs.usage(`Usage: altv-pkg [release/rc/dev]`)

yargs.command('release', 'Download altest release files', { alias: 'd' }, () => {
    branch = 'release';
});

yargs.command('rc', 'Download altest rc files', { alias: 'rc' }, () => {
    branch = 'rc';
});

yargs.command('dev', 'Download altest dev files', { alias: 'dev' }, () => {
    branch = 'dev';
});

async function start() {
    console.log(chalk.greenBright('===== altv-pkg ====='));
    console.log(chalk.whiteBright(`System: `), chalk.yellowBright(platform));
    console.log(chalk.whiteBright(`Branch: `), chalk.yellowBright(branch));

    const binaryDownload = platform === 'x64_linux' ? `https://cdn.altv.mp/server/${branch}/x64_linux/altv-server` : `https://cdn.altv.mp/server/${branch}/x64_win32/altv-server.exe`;

    const altvFiles = {
        // alt:V data files
        'data/vehmodels.bin': `https://cdn.altv.mp/data/${branch}/data/vehmodels.bin`,
        'data/vehmods.bin': `https://cdn.altv.mp/data/${branch}/data/vehmods.bin`,
        'data/clothes.bin': `https://cdn.altv.mp/data/${branch}/data/clothes.bin`,

        // alt:V modules
        'modules/js-module.dll': `https://cdn.altv.mp/js-module/${branch}/${platform}/modules/js-module/js-module.dll`,
        'libnode.dll': `https://cdn.altv.mp/js-module/${branch}/${platform}/modules/js-module/libnode.dll`,
    };

    if (!fs.existsSync(path.join(rootPath, 'data'))) {
        fs.mkdirSync(path.join(rootPath, 'data'));
    }

    if (!fs.existsSync(path.join(rootPath, 'modules'))) {
        fs.mkdirSync(path.join(rootPath, 'modules'));
    }

    let promises = [];
    console.log(chalk.greenBright('===== Download ====='));
    for (const [file, url] of Object.entries(altvFiles)) {
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

    const binaryPathing = binaryDownload.split('/');
    const binaryFileName = binaryPathing[binaryPathing.length - 1];

    const promise = new Promise((resolve) => {
        axios.get(binaryDownload, { responseType: 'arraybuffer' }).then(response => {
            console.log(chalk.whiteBright(`${binaryFileName}`))
            fs.writeFileSync(path.join(rootPath, binaryFileName), response.data);
            resolve();
        }).catch(error => {
            console.error(`Failed to download ${binaryFileName}: ${error}`);
            resolve();
        })
    });
    promises.push(promise);

    await Promise.all(promises);
    console.log(chalk.greenBright('===== Complete ====='));

}

start();



