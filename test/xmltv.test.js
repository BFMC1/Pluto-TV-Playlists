const test = require('node:test');
const assert = require('node:assert');

const CHANNEL_ID = 'channel-1';

const fakeAxios = {
	get: async (url) => {
		if (url.startsWith('https://boot.pluto.tv/')) {
			return {
				data: {
					sessionToken: 'test-token',
					servers: { stitcher: 'https://stitcher.example' },
					stitcherParams: 'country=US'
				}
			};
		}

		if (url.startsWith('https://service-channels.clusters.pluto.tv/v2/guide/channels')) {
			return {
				data: {
					data: [{
						id: CHANNEL_ID,
						name: 'Test Channel',
						number: 1,
						categoryIDs: ['category-1'],
						images: [{ url: 'https://images.example/logo.png' }],
						stitched: { path: '/stitch/hls/channel/test/master.m3u8' }
					}]
				}
			};
		}

		if (url.startsWith('https://service-channels.clusters.pluto.tv/v2/guide/categories')) {
			return { data: { data: [{ id: 'category-1', name: 'Test' }] } };
		}

		if (url.startsWith('https://service-channels.clusters.pluto.tv/v2/guide/timelines')) {
			// Every timeline request returns the same programme, mimicking the
			// overlap between consecutive timeline windows.
			return {
				data: {
					data: [{
						channelId: CHANNEL_ID,
						timelines: [{
							start: '2026-01-01T00:00:00Z',
							stop: '2026-01-01T01:00:00Z',
							title: 'Test Programme',
							episode: {
								description: 'A test programme',
								series: { tile: { path: 'https://images.example/tile.jpg' } }
							}
						}]
					}]
				}
			};
		}

		throw new Error(`Unexpected request: ${url}`);
	}
};

const axiosPath = require.resolve('axios');
require.cache[axiosPath] = {
	id: axiosPath,
	filename: axiosPath,
	loaded: true,
	exports: fakeAxios
};

const api = require('../lib/plutotv/api.js');

test('generateXMLTV emits one programme when timeline windows overlap', async () => {
	await api.boot('1.2.3.4', 'client-id');
	await api.channels('1.2.3.4');
	await api.categories('1.2.3.4');
	await api.timelines('1.2.3.4');

	const xml = await api.generateXMLTV('us', false);
	const programmes = [...xml.matchAll(/<programme channel="([^"]*)" start="([^"]*)"/g)]
		.map(m => `${m[1]}|${m[2]}`);

	assert.deepStrictEqual(programmes, [`${CHANNEL_ID}|20260101000000 +0000`]);
});
