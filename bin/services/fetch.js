const fetch = require('node-fetch');

async function fetchJson(url) {
    return new Promise(async (resolve, reject) => {
        const response = await fetch(url).catch((err) => {
            return err;
        });

        if (!response) {
            reject(err);
            return;
        }

        const data = await response.json();
        if (data && data.message && data.message.includes('Not Found')) {
            reject(new Error('Failed to find data for URL.'));
            return;
        }

        resolve(data);
    });
}

module.exports = {
    fetchJson,
};
