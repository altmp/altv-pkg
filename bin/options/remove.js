const fs = require('fs');
const path = require('path');
const { logDanger, logNormal } = require('../services/logging');
const rmdir = require('rimraf');

function handleRemove(fullRepositoryName) {
    if (!fullRepositoryName || !fullRepositoryName.includes('/')) {
        logDanger("Repo name must be 'author/path'. ie. 'altv-install i stuyk/altv-os-auth'");
        process.exit(1);
    }

    const repoName = fullRepositoryName.replace(/^[^\/]*\//gm, '');
    const fullPath = path.join('./resources/', repoName);

    // Kill
    if (!fs.existsSync(fullPath)) {
        logDanger('That repository is not installed locally.', true);
    }

    rmdir(fullPath, (err) => {
        if (!err) {
            return;
        }

        logDanger('Seems the directory is in use. Close Visual Studio Code, any IDEs, etc. then try again.', true);
    });

    logNormal(`Successfully removed ${repoName}`);
    process.exit(1);
}

module.exports = {
    handleRemove,
};
