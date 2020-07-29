const rl = require('readline');
const { logNormal } = require(`./logging.js`);
const chalk = require('chalk');

const readline = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function askQuestion(question) {
    return new Promise((resolve) => {
        logNormal(`QUESTION - Press 'Enter' after typing to submit answer. Leave blank to skip.`);
        readline.question(chalk.yellowBright(`[Q] ${question}\r\n`), (response) => {
            if (!response || response === '' || response === 'skip') {
                response = false;
            }

            if (response) {
                response = response.trim();
            }

            resolve(response);
        });
    });
}

module.exports = {
    askQuestion,
};
