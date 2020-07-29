const chalk = require('chalk');

function logNormal(msg) {
    console.log(chalk.cyanBright(`[#] ${msg}`));
}

function logHeader(msg) {
    console.log(chalk.greenBright(`[#] ${msg}`));
}

function logWarning(msg) {
    console.log(chalk.yellowBright(`[#] ${msg}`));
}

function logDanger(msg, kill = false) {
    console.log(chalk.redBright(`[#] ${msg}`));

    if (kill) {
        process.exit(1);
    }
}

module.exports = {
    logNormal,
    logHeader,
    logWarning,
    logDanger,
};
