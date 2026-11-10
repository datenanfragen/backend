import config from '../../config.json' with { type: 'json' };
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';

if (!config.bbb.api_url.endsWith('/')) config.bbb.api_url += '/';

const parser = new XMLParser();

export const bbb = async (
    endpoint: 'create' | 'join' | 'isMeetingRunning' | 'getMeetings' | 'getMeetingInfo',
    params?: string | URLSearchParams | Record<string, string>,
) => {
    const search = new URLSearchParams(params);
    const checksumString = endpoint + search.toString() + config.bbb.api_key;
    const checksum = crypto.createHash('sha1').update(checksumString).digest('hex');

    search.set('checksum', checksum);

    const url = new URL(endpoint, config.bbb.api_url);
    url.search = search.toString();

    if (endpoint === 'join') return url.toString();

    const response = await fetch(url);
    const xml = await response.text();
    if (!response.ok) throw new Error(response.statusText + ' :: ' + xml);

    const result = parser.parse(xml).response;
    if (result.returncode === 'FAILED') throw new Error(result.messageKey + ' :: ' + result.message);

    return result;
};
