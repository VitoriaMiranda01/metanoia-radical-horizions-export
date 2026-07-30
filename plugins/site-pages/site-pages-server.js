import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import traverseBabel from '@babel/traverse';
import * as t from '@babel/types';

const ECOMMERCE_API_RELATIVE_PATH = '../../src/api/EcommerceApi.js';

const HOME_ROUTE_LABEL = 'Main';
const PRODUCT_PAGE_FETCH_LIMIT = 100;
const MAX_PRODUCT_PAGES = 50;

/**
 * Resolves the tag name of a JSX element, unwrapping member expressions (e.g. `Foo.Bar` → `Bar`).
 *
 * @param {import('@babel/types').JSXOpeningElement['name']} nameNode
 * @returns {string|null}
 */
function getJsxElementName(nameNode) {
	if (t.isJSXIdentifier(nameNode)) {
		return nameNode.name;
	}
	if (t.isJSXMemberExpression(nameNode) && t.isJSXIdentifier(nameNode.property)) {
		return nameNode.property.name;
	}
	return null;
}

/**
 * Reads a string literal from an attribute value, including one wrapped in a JSX expression container.
 *
 * @param {import('@babel/types').Node|null|undefined} value
 * @returns {string|null}
 */
function getStringLiteral(value) {
	if (!value) return null;
	if (t.isStringLiteral(value)) return value.value;
	if (t.isJSXExpressionContainer(value) && t.isStringLiteral(value.expression)) {
		return value.expression.value;
	}
	return null;
}

/**
 * Reads a JSX element from an attribute value, including one wrapped in a JSX expression container.
 *
 * @param {import('@babel/types').Node|null|undefined} value
 * @returns {import('@babel/types').JSXElement|null}
 */
function getJsxElement(value) {
	if (t.isJSXElement(value)) return value;
	if (t.isJSXExpressionContainer(value) && t.isJSXElement(value.expression)) {
		return value.expression;
	}
	return null;
}

/**
 * Extracts the `path` and element component name from a `<Route>` opening element.
 *
 * @param {import('@babel/types').JSXOpeningElement} openingNode
 * @returns {{ routePath: string, componentName: string }|null}
 */
function parseRoute(openingNode) {
	if (getJsxElementName(openingNode.name) !== 'Route') return null;

	const pathAttr = openingNode.attributes.find((a) => t.isJSXAttribute(a) && a.name?.name === 'path');
	const elementAttr = openingNode.attributes.find((a) => t.isJSXAttribute(a) && a.name?.name === 'element');

	const routePath = getStringLiteral(pathAttr?.value);
	if (routePath === null) return null;

	const element = getJsxElement(elementAttr?.value);
	const componentName = element && getJsxElementName(element.openingElement.name);
	if (!componentName) return null;

	return { routePath, componentName };
}

/**
 * Maps default import local names to their module source for one import declaration.
 *
 * @param {import('@babel/types').ImportDeclaration} importNode
 * @returns {Record<string, string>}
 */
function parseImports(importNode) {
	const source = importNode.source.value;
	return Object.fromEntries(
		importNode.specifiers
			.filter(t.isImportDefaultSpecifier)
			.map((specifier) => [specifier.local.name, source]),
	);
}

/**
 * Reads the text of the `<title>` inside a `<Helmet>` element, if present.
 *
 * @param {import('@babel/types').JSXElement} jsxElement
 * @returns {string|null}
 */
function parseHelmetTitle(jsxElement) {
	if (getJsxElementName(jsxElement.openingElement.name) !== 'Helmet') return null;

	for (const child of jsxElement.children) {
		if (!t.isJSXElement(child) || getJsxElementName(child.openingElement.name) !== 'title') continue;

		const titleChild = child.children[0];
		if (t.isJSXText(titleChild)) return titleChild.value.trim();
		if (t.isJSXExpressionContainer(titleChild) && t.isStringLiteral(titleChild.expression)) {
			return titleChild.expression.value;
		}
	}
	return null;
}

/**
 * Scans one file's AST. Router files yield routes + imports; page files yield helmetTitle.
 *
 * @param {import('@babel/types').File} ast
 * @returns {{ routes: Array<{ routePath: string, componentName: string }>, imports: Record<string, string>, helmetTitle: string|null, usesEcommerceApi: boolean }}
 */
export function scanFile(ast) {
	const routes = [];
	const imports = {};
	let helmetTitle = null;
	let usesEcommerceApi = false;

	(traverseBabel.default)(ast, {
		enter(nodePath) {
			if (nodePath.isJSXOpeningElement()) {
				const route = parseRoute(nodePath.node);
				if (route) routes.push(route);
				return;
			}
			if (nodePath.isImportDeclaration()) {
				Object.assign(imports, parseImports(nodePath.node));
				if (nodePath.node.source.value.includes('EcommerceApi')) {
					usesEcommerceApi = true;
				}
				return;
			}
			if (nodePath.isJSXElement()) {
				const title = parseHelmetTitle(nodePath.node);
				if (title) helmetTitle = title;
			}
		},
	});

	return { routes, imports, helmetTitle, usesEcommerceApi };
}

/**
 * Merges one file's scan result into the running index, replacing any previous
 * entries contributed by that same file.
 *
 * @param {{ routerEntries: Array<{ routePath: string, componentName: string, routerFileId: string, imports: Record<string, string> }>, titlesByPageFile: Record<string, string>, ecommercePageFiles: Record<string, boolean> }} index
 * @param {string} fileId
 * @param {{ routes: Array<{ routePath: string, componentName: string }>, imports: Record<string, string>, helmetTitle: string|null, usesEcommerceApi: boolean }} scan
 * @returns {{ routerEntries: Array<{ routePath: string, componentName: string, routerFileId: string, imports: Record<string, string> }>, titlesByPageFile: Record<string, string>, ecommercePageFiles: Record<string, boolean> }}
 */
export function upsertFile(index, fileId, scan) {
	const routerEntries = [
		...index.routerEntries.filter((entry) => entry.routerFileId !== fileId),
		...scan.routes.map(({ routePath, componentName }) => ({
			routePath,
			componentName,
			routerFileId: fileId,
			imports: scan.imports,
		})),
	];

	const titlesByPageFile = Object.fromEntries(
		Object.entries(index.titlesByPageFile).filter(([key]) => key !== fileId),
	);
	if (scan.helmetTitle) {
		titlesByPageFile[fileId] = scan.helmetTitle;
	}

	const ecommercePageFiles = Object.fromEntries(
		Object.entries(index.ecommercePageFiles).filter(([key]) => key !== fileId),
	);
	if (scan.usesEcommerceApi) {
		ecommercePageFiles[fileId] = true;
	}

	return { routerEntries, titlesByPageFile, ecommercePageFiles };
}

/**
 * Chooses a display label for a route: the home label for `/`, otherwise the
 * helmet title when available, falling back to the component name.
 *
 * @param {string} routePath
 * @param {string} componentName
 * @param {string|null} helmetTitle
 * @returns {string}
 */
export function resolvePageLabel(routePath, componentName, helmetTitle) {
	if (routePath === '/') return HOME_ROUTE_LABEL;
	return helmetTitle ?? componentName;
}

/**
 * Substitutes the first dynamic segment of a route with a concrete value.
 * The param name is derived from the route (e.g. ":slug", ":productId"), not
 * assumed to be ":id", since route params are authored by generated code.
 *
 * @param {string} routePath
 * @param {string} productId
 * @returns {string}
 */
export function buildProductPath(routePath, productId) {
	const paramToken = routePath.match(/:[^/]+/)?.[0];
	return paramToken ? routePath.replace(paramToken, productId) : routePath;
}

/**
 * Expands a dynamic product route into one concrete page entry per product.
 *
 * @param {Array<{ id: string, title: string }>} products
 * @param {string} routePath
 * @param {string} componentName
 * @returns {Array<{ path: string, label: string, helmetTitle: string, component: string, dynamic: true }>}
 */
export function mapProductsToPages(products, routePath, componentName) {
	return products.map((product) => ({
		path: buildProductPath(routePath, product.id),
		label: product.title,
		helmetTitle: product.title,
		component: componentName,
		dynamic: true,
	}));
}

/**
 * Fetches every product by paging the store API until a short page is returned,
 * bounded by MAX_PRODUCT_PAGES. EcommerceApi is imported lazily so non-ecommerce
 * sites never resolve a module that does not exist for them.
 *
 * Import via absolute file URL: after Vite bundles this plugin into
 * vite.config.js.timestamp-*.mjs, relative imports resolve against the bundle
 * path instead of the original plugin location.
 *
 * @param {string} ecommerceApiPath Absolute filesystem path to EcommerceApi.js
 * @returns {Promise<Array<{ id: string, title: string }>>}
 */
async function fetchAllProducts(ecommerceApiPath) {
	const { getProducts } = await import(pathToFileURL(ecommerceApiPath).href);

	const collected = [];
	for (let page = 0; page < MAX_PRODUCT_PAGES; page++) {
		const { products = [] } = await getProducts({
			limit: PRODUCT_PAGE_FETCH_LIMIT,
			offset: page * PRODUCT_PAGE_FETCH_LIMIT,
		});

		collected.push(...products);

		if (products.length < PRODUCT_PAGE_FETCH_LIMIT) {
			break;
		}
	}

	return collected;
}

/**
 * Builds the flat list of site pages from the scanned index, resolving each route's
 * page module and expanding ecommerce product routes. Returns only routes actually
 * detected by the scan (no synthetic home fallback).
 *
 * @param {{ routerEntries: Array<{ routePath: string, componentName: string, routerFileId: string, imports: Record<string, string> }>, titlesByPageFile: Record<string, string>, ecommercePageFiles: Record<string, boolean> }} index
 * @param {(specifier: string, importer: string) => Promise<{ id: string }|null>} resolveModule
 * @param {string} projectRoot
 * @returns {Promise<Array<{ path: string, label: string, helmetTitle: string|null, component: string|null, file?: string|null, dynamic?: true }>>}
 */
export async function buildPageList(index, resolveModule, projectRoot) {
	const groups = await Promise.all(
		index.routerEntries.map(async ({ routePath, componentName, routerFileId, imports }) => {
			const moduleSpecifier = imports[componentName];
			const resolved = moduleSpecifier
				? await resolveModule(moduleSpecifier, routerFileId)
				: null;
			const pageFileId = resolved?.id ?? null;

			if (routePath.includes(':')) {
				// Only ecommerce product routes are expanded into concrete pages.
				// Other dynamic routes (e.g. blog/CMS detail pages) are intentionally
				// skipped since we have no data source to enumerate their instances.
				if (!pageFileId || !index.ecommercePageFiles[pageFileId]) {
					return [];
				}

				const ecommerceApiPath = fileURLToPath(new URL(ECOMMERCE_API_RELATIVE_PATH, import.meta.url));
				if (!existsSync(ecommerceApiPath)) {
					return [];
				}

				try {
					const products = await fetchAllProducts(ecommerceApiPath);

					return mapProductsToPages(products, routePath, componentName);
				} catch (error) {
					console.error(`[site-pages] Failed to expand dynamic route "${routePath}":`, error);
					return [];
				}
			}

			const helmetTitle = pageFileId ? (index.titlesByPageFile[pageFileId] ?? null) : null;

			return [{
				path: routePath,
				label: resolvePageLabel(routePath, componentName, helmetTitle),
				helmetTitle,
				component: componentName,
				file: pageFileId
					? path.relative(projectRoot, pageFileId).split(path.sep).join('/')
					: null,
			}];
		}),
	);

	return groups.flat();
}
