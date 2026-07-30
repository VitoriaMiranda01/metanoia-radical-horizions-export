import { context } from 'esbuild';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { EDIT_MODE_STYLES } from './ui/inline-edit/styles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

/**
 * Bundles the multi-file contenteditable edit-mode runtime with esbuild and
 * injects it (plus the edit-mode styles) into the dev preview HTML.
 *
 * @returns {import('vite').Plugin}
 */
export default function inlineEditDevPlugin() {
	let buildContext = null;

	return {
		name: 'vite:inline-edit-dev',
		apply: 'serve',

		async buildStart() {
			buildContext = await context({
				entryPoints: [resolve(__dirname, 'edit-mode-script.js')],
				bundle: true,
				format: 'esm',
				sourcemap: 'inline',
				write: false,
				platform: 'browser',
				target: 'es2020',
			});
		},

		async transformIndexHtml() {
			const { outputFiles } = await buildContext.rebuild();
			return [
				{
					tag: 'script',
					attrs: { type: 'module' },
					children: outputFiles[0].text,
					injectTo: 'body',
				},
				{
					tag: 'style',
					children: EDIT_MODE_STYLES,
					injectTo: 'head',
				},
			];
		},

		closeBundle() {
			buildContext?.dispose();
		},
	};
}
