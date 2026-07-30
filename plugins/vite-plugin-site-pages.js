import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { VITE_PROJECT_ROOT } from './utils/ast-utils.js';
import { isSameOriginRequest } from './utils/same-origin.js';
import {
	buildPageList,
	scanFile,
	upsertFile,
} from './site-pages/site-pages-server.js';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const SITE_PAGES_ENDPOINT = '/__horizons/site-pages';
const SITE_PAGES_SCRIPT = readFileSync(resolve(__dirname, 'site-pages/site-pages-script.js'), 'utf-8');

/**
 * Scan routes from JSX, expose them at /__horizons/site-pages,
 * and post them to the Horizons parent frame from the preview iframe.
 *
 * @returns {import('vite').Plugin}
 */
export default function sitePagesPlugin() {
	let index = { routerEntries: [], titlesByPageFile: {}, ecommercePageFiles: {} };

	return {
		name: 'vite:site-pages',
		apply: 'serve',
		enforce: 'pre',

		transform(code, id) {
			if (!/\.(jsx|tsx)$/.test(id) || !id.startsWith(VITE_PROJECT_ROOT) || id.includes('node_modules')) {
				return null;
			}

			try {
				const ast = parse(code, {
					sourceType: 'module',
					plugins: ['jsx', 'typescript'],
					errorRecovery: true,
				});

				index = upsertFile(index, id, scanFile(ast));
			} catch (error) {
				console.error(`[site-pages] Error scanning ${id}:`, error);
			}

			return null;
		},

		configureServer(server) {
			server.middlewares.use(SITE_PAGES_ENDPOINT, async (request, response, next) => {
				if (request.method !== 'GET') {
					next();
					return;
				}

				if (!isSameOriginRequest(request)) {
					response.statusCode = 403;
					response.setHeader('Content-Type', 'application/json');
					response.end(JSON.stringify({ error: 'Forbidden' }));
					return;
				}

				try {
					const pages = await buildPageList(
						index,
						(specifier, importer) => server.pluginContainer.resolveId(specifier, importer),
						VITE_PROJECT_ROOT,
					);

					response.setHeader('Content-Type', 'application/json');
					response.end(JSON.stringify(pages));
				} catch (error) {
					response.statusCode = 500;
					response.setHeader('Content-Type', 'application/json');
					response.end(JSON.stringify({ error: error.message }));
				}
			});
		},

		transformIndexHtml() {
			return [{
				tag: 'script',
				attrs: { type: 'module' },
				children: SITE_PAGES_SCRIPT,
				injectTo: 'head',
			}];
		},
	};
}
