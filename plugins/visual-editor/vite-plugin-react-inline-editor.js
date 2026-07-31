import path from 'path';
import { parse } from '@babel/parser';
import traverseBabel from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs';
import {
	parseFileToAST,
	generateSourceWithMap,
	VITE_PROJECT_ROOT
} from '../utils/ast-utils.js';
import { isSameOriginRequest } from '../utils/same-origin.js';
import { groupEditsByFile, applyElementEdit, writeBackEdits } from './server/source-writer.js';

const EDITABLE_JSX_TAGS = ["a", "Link", "button", "Button", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "label", "Label", "img"];

// Inline tags that are treated as editable text content of their parent rather
// than as independently editable elements. A parent containing only these (plus
// text) stays editable as a single contenteditable region; the inline markup is
// preserved/rebuilt on write-back by `buildChildrenFromText`.
const INLINE_EDIT_HTML_TAGS = ["br", "strong", "em", "b", "i", "u", "span", "a"];

function checkTagNameEditable(openingElementNode, editableTagsList = EDITABLE_JSX_TAGS) {
	if (!openingElementNode || !openingElementNode.name) return false;
	const nameNode = openingElementNode.name;

	// Check 1: Direct name (for <p>, <Button>)
	if (nameNode.type === 'JSXIdentifier' && editableTagsList.includes(nameNode.name)) {
		return true;
	}

	// Check 2: Property name of a member expression (for <motion.h1>, check if "h1" is in editableTagsList)
	if (nameNode.type === 'JSXMemberExpression' && nameNode.property && nameNode.property.type === 'JSXIdentifier' && editableTagsList.includes(nameNode.property.name)) {
		return true;
	}

	return false;
}

function validateImageSrc(openingNode) {
	if (!openingNode || !openingNode.name || ( openingNode.name.name !== 'img' && openingNode.name.property?.name !== 'img')) {
		return { isValid: true, reason: null }; // Not an image, skip validation
	}

	const hasPropsSpread = openingNode.attributes.some(attribute =>
		t.isJSXSpreadAttribute(attribute) &&
		attribute.argument &&
		t.isIdentifier(attribute.argument) &&
		attribute.argument.name === 'props'
	);

	if (hasPropsSpread) {
		return { isValid: false, reason: 'props-spread' };
	}

	const sourceAttribute = openingNode.attributes.find(attribute =>
		t.isJSXAttribute(attribute) &&
		attribute.name &&
		attribute.name.name === 'src'
	);

	if (!sourceAttribute) {
		return { isValid: false, reason: 'missing-src' };
	}

	if (!t.isStringLiteral(sourceAttribute.value)) {
		return { isValid: false, reason: 'dynamic-src' };
	}

	if (!sourceAttribute.value.value || sourceAttribute.value.value.trim() === '') {
		return { isValid: false, reason: 'empty-src' };
	}

	return { isValid: true, reason: null };
}

/**
 * For an editable `<a>` / `<Link>` / `<NavLink>`, returns the name of the URL
 * attribute (`href` or `to`) when it holds a static string literal, so the
 * inline editor can edit the link in place and write it back to source.
 * Returns `null` for non-link tags or dynamic/expression URLs.
 * @param {import('@babel/types').JSXOpeningElement} openingNode
 * @returns {string|null}
 */
function detectUrlAttribute(openingNode) {
	const tagName = openingNode.name?.name || openingNode.name?.property?.name || '';
	let attributeName = null;
	if (tagName === 'a') attributeName = 'href';
	else if (tagName === 'Link' || tagName === 'NavLink') attributeName = 'to';
	if (!attributeName) return null;

	const matchedAttribute = openingNode.attributes.find(attribute =>
		t.isJSXAttribute(attribute) && attribute.name?.name === attributeName
	);
	if (!matchedAttribute || !matchedAttribute.value) return null;

	if (t.isStringLiteral(matchedAttribute.value)) return attributeName;
	if (t.isJSXExpressionContainer(matchedAttribute.value) && t.isStringLiteral(matchedAttribute.value.expression)) return attributeName;

	return null;
}

/**
 * Recursively detects whether a JSX subtree renders any dynamic `{...}`
 * expression. Used to tell whether an element's visible text is produced at
 * runtime (e.g. `<span>{word}</span>` or `{letters.map(...)}`); such elements
 * must not be flagged as inline-editable.
 * @param {import('@babel/types').Node} node
 * @returns {boolean}
 */
function subtreeContainsDynamicExpression(node) {
	if (!node || !Array.isArray(node.children)) return false;
	return node.children.some(child => {
		if (t.isJSXExpressionContainer(child)) return true;
		if (t.isJSXElement(child) || t.isJSXFragment(child)) return subtreeContainsDynamicExpression(child);
		return false;
	});
}

export default function inlineEditPlugin() {
	const recentDraftWrites = new Map();
	const DRAFT_WRITE_HMR_SUPPRESS_MILLISECONDS = 2000;

	return {
		name: 'vite-inline-edit-plugin',
		enforce: 'pre',

		handleHotUpdate(context) {
			const expiry = recentDraftWrites.get(context.file);
			if (expiry === undefined) return;
			if (Date.now() <= expiry) {
				return [];
			}
			recentDraftWrites.delete(context.file);
		},

		transform(code, id) {
			if (!/\.(jsx|tsx)$/.test(id) || !id.startsWith(VITE_PROJECT_ROOT) || id.includes('node_modules')) {
				return null;
			}

			const relativeFilePath = path.relative(VITE_PROJECT_ROOT, id);
			const webRelativeFilePath = relativeFilePath.split(path.sep).join('/');

			try {
				const babelAst = parse(code, {
					sourceType: 'module',
					plugins: ['jsx', 'typescript'],
					errorRecovery: true
				});

				let attributesAdded = 0;

				traverseBabel.default(babelAst, {
					enter(path) {
						if (path.isJSXOpeningElement()) {
							const openingNode = path.node;
							const elementNode = path.parentPath.node; // The JSXElement itself

							if (!openingNode.loc) {
								return;
							}

							const alreadyHasId = openingNode.attributes.some(
								(attribute) => t.isJSXAttribute(attribute) && attribute.name.name === 'data-edit-id'
							);

							if (alreadyHasId) {
								return;
							}

							// Condition 1: Is the current element tag type editable?
							const isCurrentElementEditable = checkTagNameEditable(openingNode, EDITABLE_JSX_TAGS);
							if (!isCurrentElementEditable) {
								return;
							}

							const imageValidation = validateImageSrc(openingNode);
							if (!imageValidation.isValid) {
								const disabledAttribute = t.jsxAttribute(
									t.jsxIdentifier('data-edit-disabled'),
									t.stringLiteral('true')
								);
								openingNode.attributes.push(disabledAttribute);
								attributesAdded++;
								return;
							}

							let shouldBeDisabledDueToChildren = false;

							// Condition 2: Does the element have dynamic or editable children
							if (t.isJSXElement(elementNode) && elementNode.children) {
								// Check if element has {...props} spread attribute - disable editing if it does
								const hasPropsSpread = openingNode.attributes.some(attribute => t.isJSXSpreadAttribute(attribute)
									&& attribute.argument
									&& t.isIdentifier(attribute.argument)
									&& attribute.argument.name === 'props'
								);

								const hasDynamicChild = elementNode.children.some(child =>
									t.isJSXExpressionContainer(child)
									|| ((t.isJSXElement(child) || t.isJSXFragment(child)) && subtreeContainsDynamicExpression(child))
								);

								if (hasDynamicChild || hasPropsSpread) {
									shouldBeDisabledDueToChildren = true;
								}
							}

							if (!shouldBeDisabledDueToChildren && t.isJSXElement(elementNode) && elementNode.children) {
								const hasEditableJsxChild = elementNode.children.some(child => {
									if (t.isJSXElement(child)) {
										const childName = child.openingElement.name?.name || '';
										// Inline tags (links, bold, italic, ...) belong to the
										// parent's editable text, so they must NOT disable it.
										if (INLINE_EDIT_HTML_TAGS.includes(childName)) {
											return false;
										}
										return checkTagNameEditable(child.openingElement, EDITABLE_JSX_TAGS);
									}

									return false;
								});

								if (hasEditableJsxChild) {
									shouldBeDisabledDueToChildren = true;
								}
							}

							if (shouldBeDisabledDueToChildren) {
								const disabledAttribute = t.jsxAttribute(
									t.jsxIdentifier('data-edit-disabled'),
									t.stringLiteral('true')
								);

								openingNode.attributes.push(disabledAttribute);
								attributesAdded++;
								return;
							}

							// Condition 3: Parent is non-editable if it has non-editable, non-icon JSX children.
							if (t.isJSXElement(elementNode) && elementNode.children && elementNode.children.length > 0) {
								let hasTextContent = false;
								let hasNonEditableJsxChild = false;
								let hasNonSelfClosingChild = false;
								let hasInlineTagChild = false;

								for (const child of elementNode.children) {
									if (t.isJSXText(child)) {
										if (child.value.trim().length > 0) hasTextContent = true;
										continue;
									}
								if (t.isJSXElement(child)) {
									const childNode = child.openingElement;
									const childName = childNode.name?.name || '';
									if (childNode.selfClosing) {
										if (!/^[A-Z]/.test(childName) && !checkTagNameEditable(childNode, EDITABLE_JSX_TAGS) && !INLINE_EDIT_HTML_TAGS.includes(childName)) {
											hasNonEditableJsxChild = true;
										}
										continue;
									}
									// Inline tags (a, strong, em, b, i, u, span) are editable text
									// content kept inside the parent's contenteditable region.
									if (INLINE_EDIT_HTML_TAGS.includes(childName)) {
										hasInlineTagChild = true;
										continue;
									}
									hasNonSelfClosingChild = true;
									if (!checkTagNameEditable(childNode, EDITABLE_JSX_TAGS)) {
										hasNonEditableJsxChild = true;
									}
								}
								}

								if (!hasTextContent && !hasNonSelfClosingChild && !hasInlineTagChild) return;

								if (hasNonEditableJsxChild) {
									const disabledAttribute = t.jsxAttribute(
										t.jsxIdentifier('data-edit-disabled'),
										t.stringLiteral("true")
									);
									openingNode.attributes.push(disabledAttribute);
									attributesAdded++;
									return;
								}
							}

							// Condition 4: Is any ancestor JSXElement also editable?
							let currentAncestorCandidatePath = path.parentPath.parentPath;
							while (currentAncestorCandidatePath) {
								const ancestorJsxElementPath = currentAncestorCandidatePath.isJSXElement()
									? currentAncestorCandidatePath
									: currentAncestorCandidatePath.findParent(candidatePath => candidatePath.isJSXElement());

								if (!ancestorJsxElementPath) {
									break;
								}

								if (checkTagNameEditable(ancestorJsxElementPath.node.openingElement, EDITABLE_JSX_TAGS)) {
									return;
								}
								currentAncestorCandidatePath = ancestorJsxElementPath.parentPath;
							}

							const line = openingNode.loc.start.line;
							const column = openingNode.loc.start.column + 1;
							const editId = `${webRelativeFilePath}:${line}:${column}`;

							const idAttribute = t.jsxAttribute(
								t.jsxIdentifier('data-edit-id'),
								t.stringLiteral(editId)
							);

							openingNode.attributes.push(idAttribute);
							attributesAdded++;

							// For editable links with a static URL, expose which
							// attribute (`href`/`to`) the inline editor should write
							// back when the link target is changed in place.
							const urlAttributeName = detectUrlAttribute(openingNode);
							if (urlAttributeName) {
								openingNode.attributes.push(
									t.jsxAttribute(
										t.jsxIdentifier('data-edit-url-attr'),
										t.stringLiteral(urlAttributeName)
									)
								);
							}
						}
					}
				});

				if (attributesAdded > 0) {
					const output = generateSourceWithMap(babelAst, webRelativeFilePath, code);
					return { code: output.code, map: output.map };
				}

				return null;
			} catch (error) {
				console.error(`[vite][visual-editor] Error transforming ${id}:`, error);
				return null;
			}
		},


		// Persists a batch of draft edits to source when the user saves.
		configureServer(server) {
			server.middlewares.use('/api/draft-save', async (request, response, next) => {
				if (request.method !== 'POST') return next();

				if (!isSameOriginRequest(request)) {
					response.writeHead(403, { 'Content-Type': 'application/json' });
					return response.end(JSON.stringify({ error: 'Forbidden' }));
				}

				let body = '';
				request.on('data', chunk => { body += chunk.toString(); });

				request.on('end', async () => {
					let parsedBody;
					try {
						parsedBody = JSON.parse(body);
					} catch {
						response.writeHead(400, { 'Content-Type': 'application/json' });
						return response.end(JSON.stringify({ error: 'Invalid JSON request body' }));
					}

					if (!parsedBody || typeof parsedBody !== 'object') {
						response.writeHead(400, { 'Content-Type': 'application/json' });
						return response.end(JSON.stringify({ error: 'Invalid JSON request body' }));
					}

					try {
						const { draft } = parsedBody;

						if (!draft || typeof draft !== 'object') {
							response.writeHead(400, { 'Content-Type': 'application/json' });
							return response.end(JSON.stringify({ error: 'Missing or invalid draft object' }));
						}

						const { editsByFile, results } = groupEditsByFile(draft);

						for (const [absoluteFilePath, fileEdits] of editsByFile) {
							const originalContent = fs.readFileSync(absoluteFilePath, 'utf-8');
							const babelAst = parseFileToAST(absoluteFilePath);
							let fileModified = false;

							for (const { draftKey, edit, parsedId } of fileEdits) {
								const { modified, error } = applyElementEdit(babelAst, edit, parsedId);
								if (!modified) {
									results.push({ draftKey, success: false, error });
									continue;
								}
								fileModified = true;
							}

							if (fileModified) {
								// Suppress the HMR reload this write triggers so the pending save fetch survives.
								recentDraftWrites.set(path.resolve(absoluteFilePath), Date.now() + DRAFT_WRITE_HMR_SUPPRESS_MILLISECONDS);
								results.push(writeBackEdits(babelAst, absoluteFilePath, originalContent));
							}
						}

						response.writeHead(200, { 'Content-Type': 'application/json' });
						response.end(JSON.stringify({ success: true, results }));
					} catch (error) {
						console.error('[vite][visual-editor] Error in draft-save:', error);
						response.writeHead(500, { 'Content-Type': 'application/json' });
						response.end(JSON.stringify({ error: 'Internal server error during draft save.' }));
					}
				});
			});
		}
	};
}