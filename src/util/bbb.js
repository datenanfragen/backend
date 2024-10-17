const config = require('../../config.json').bbb;
const crypto = require('crypto');
const { XMLParser } = require('fast-xml-parser');

if (!config.api_url.endsWith('/')) config.api_url += '/';

const parser = new XMLParser();

/**
 * @param {'create' | 'join' | 'isMeetingRunning' | 'getMeetings' | 'getMeetingInfo'} endpoint
 * @param {URLSearchParams | string} params
 */
const bbb = async (endpoint, params) => {
    const search = new URLSearchParams(params);
    const checksumString = endpoint + search.toString() + config.api_key;
    const checksum = crypto.createHash('sha1').update(checksumString).digest('hex');

    search.set('checksum', checksum);

    const url = new URL(endpoint, config.api_url);
    url.search = search;

    if (endpoint === 'join') return url.toString();

    const response = await fetch(url);
    const xml = await response.text();
    if (!response.ok) throw new Error(response.statusText + ' :: ' + xml);

    const result = parser.parse(xml).response;
    if (result.returncode === 'FAILED') throw new Error(result.messageKey + ' :: ' + result.message);

    return result;
};

module.exports = { bbb };
