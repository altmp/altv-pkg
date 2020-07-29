const fs = require('fs');
const path = require('path');
const { logDanger } = require('./logging');

const pathsToCheck = [
    {
        fullPath: path.join('./', 'package.json'),
        error: `Could not find package.json in local directory. Initialize your directory with 'npm init' to continue.`,
    },
    {
        fullPath: path.join('./', 'altv-server'),
        error: `Could not find 'altv-server' in local directory. Please download alt:V Server files first.`,
    },
];

const resourcesPath = path.join('./', 'resources');

function verifyPaths() {
    if (!fs.existsSync(resourcesPath)) {
        fs.mkdirSync(resourcesPath);
    }

    for (let i = 0; i < pathsToCheck.length; i++) {
        const pathData = pathsToCheck[i];
        if (!fs.existsSync(pathData.fullPath)) {
            logDanger(pathData.error);
            return false;
        }
    }

    return true;
}

module.exports = {
    verifyPaths,
};
