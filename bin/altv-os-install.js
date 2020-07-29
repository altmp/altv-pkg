#!/usr/bin/env node
const program = require('commander');
const { handleInstall } = require('./options/install');
const { handleRemove } = require('./options/remove');

// Properties
program.version('0.0.1');
program.name('altv-install');
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

// Parse Args.
program.parse(process.argv);
