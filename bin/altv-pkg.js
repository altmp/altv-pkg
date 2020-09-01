#!/usr/bin/env node
const program = require('commander');
const { handleInstall } = require('./options/install');
const { handleRemove } = require('./options/remove');
const { handleDownload } = require('./options/download');

// Properties
program.version('1.0.2');
program.name('altv-pkg');
program.usage('<command> [options]');

// Options
program
    .command('install <author/repo>')
    .alias('i')
    .description('Install an alt:V resource from GitHub.')
    .action(handleInstall);

program
    .command('remove <author/repo>')
    .alias('r')
    .description('Remove an alt:V resource from local installation.')
    .action(handleRemove);

program
    .command(`download <branch>`)
    .alias('d')
    .description('Install alt:V server framework from CDN.')
    .action(handleDownload);

// Parse Args.
program.parse(process.argv);
