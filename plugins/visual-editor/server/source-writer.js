import fs from 'fs';
import path from 'path';
import traverseBabel from '@babel/traverse';
import * as t from '@babel/types';
import {
	validateFilePath,
	findJSXElementAtPosition,
	generateSourceWithMap,
	VITE_PROJECT_ROOT,
} from '../../utils/ast-utils.js';
import { decodeHtmlEntities, cssPropToCamel } from '../utils/html-utils.js';

/**
 * Parses `filePath:line:column` edit IDs produced by the transform plugin.
 *
 * @param {string} editId
 * @returns {{ filePath: string, line: number, column: number }|null}
 */
function parseEditId(editId) {
	const segments = editId.split(':');
	if (segments.length < 3) return null;
	const column = parseInt(segments.at(-1), 10);
	const line = parseInt(segments.at(-2), 10);
	const filePath = segments.slice(0, -2).join(':');
	if (!filePath || isNaN(line) || isNaN(column)) return null;
	return { filePath, line, column };
}

/**
 * Converts an HTML `style="..."` string into a Babel JSX style object expression.
 *
 * @param {string} styleString
 * @returns {import('@babel/types').JSXExpressionContainer}
 */
function parseStyleString(styleString) {
	const decoded = decodeHtmlEntities(styleString);
	const properties = [];
	for (const declaration of decoded.split(';')) {
		const colonIndex = declaration.indexOf(':');
		if (colonIndex < 0) continue;
		const key = declaration.slice(0, colonIndex).trim();
		const value = declaration.slice(colonIndex + 1).trim();
		if (!key || !value) continue;
		properties.push(
			t.objectProperty(t.identifier(cssPropToCamel(key)), t.stringLiteral(value))
		);
	}
	return t.jsxExpressionContainer(t.objectExpression(properties));
}

/**
 * Parses HTML attribute string from saved innerHTML into JSX attribute nodes.
 * Skips `data-edit-*` attributes; maps `class`/`for` to React names.
 *
 * @param {string} rawAttributes
 * @returns {import('@babel/types').JSXAttribute[]}
 */
function parseHtmlAttributesToJsx(rawAttributes) {
	if (!rawAttributes || !rawAttributes.trim()) return [];
	const attributes = [];
	const ATTRIBUTE_REGEX = /([\w-]+)\s*=\s*"([^"]*)"/g;
	let match;
	while ((match = ATTRIBUTE_REGEX.exec(rawAttributes)) !== null) {
		let [, name, value] = match;
		// data-edit-* are injected by the visual-editor transform; never write them to source
		if (name.startsWith('data-edit-')) continue;
		if (name === 'class') name = 'className';
		if (name === 'for') name = 'htmlFor';
		if (name === 'style') {
			attributes.push(t.jsxAttribute(t.jsxIdentifier(name), parseStyleString(value)));
		} else {
			attributes.push(t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(decodeHtmlEntities(value))));
		}
	}
	return attributes;
}

/**
 * Rebuilds JSX children from saved innerHTML, preserving known inline tags and dropping SVG-like markup.
 *
 * @param {string} html
 * @returns {import('@babel/types').JSXChild[]}
 */
function buildChildrenFromText(html) {
	if (!html || html.trim() === '') return [];

	// Decode only &lt;/&gt; so entity-encoded markup is recognised as tags and
	// stripped by the skipDepth logic below. Do NOT decode &quot; here: attribute
	// values are delimited by " in TAG_REGEX.
	html = html.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

	const KNOWN_INLINE = /^(?:strong|em|b|i|u|span|br|a)$/i;
	const TAG_REGEX = /<(\/?)(\w+)((?:\s+[\w-]+(?:\s*=\s*"[^"]*")?)*)\s*(\/?)>/g;

	const result = [];
	const stack = [{ children: result }];
	let lastIndex = 0;
	/** Nesting depth inside non-inline tags (e.g. svg); content within is dropped. */
	let skipDepth = 0;
	let match;

	while ((match = TAG_REGEX.exec(html)) !== null) {
		const [full, closing, tagName, rawAttributes, selfClose] = match;
		const isInline = KNOWN_INLINE.test(tagName);

		if (!isInline) {
			if (skipDepth === 0 && match.index > lastIndex) {
				const text = html.slice(lastIndex, match.index);
				if (text) stack[stack.length - 1].children.push(t.jsxText(text));
			}
			if (selfClose !== '/') {
				if (closing === '/') {
					if (skipDepth > 0) skipDepth--;
				} else {
					skipDepth++;
				}
			}
			lastIndex = match.index + full.length;
			continue;
		}

		if (skipDepth > 0) {
			lastIndex = match.index + full.length;
			continue;
		}

		if (match.index > lastIndex) {
			const text = html.slice(lastIndex, match.index);
			if (text) stack[stack.length - 1].children.push(t.jsxText(text));
		}
		lastIndex = match.index + full.length;

		const lower = tagName.toLowerCase();

		if (lower === 'br' || selfClose === '/') {
			stack[stack.length - 1].children.push(
				t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(lower), [], true), null, [], true)
			);
		} else if (closing === '/') {
			if (stack.length > 1) {
				const frame = stack.pop();
				const attributes = parseHtmlAttributesToJsx(frame.rawAttrs);
				stack[stack.length - 1].children.push(
					t.jsxElement(
						t.jsxOpeningElement(t.jsxIdentifier(frame.tag), attributes),
						t.jsxClosingElement(t.jsxIdentifier(frame.tag)),
						frame.children
					)
				);
			}
		} else {
			stack.push({ tag: lower, children: [], rawAttrs: rawAttributes || '' });
		}
	}

	if (skipDepth === 0 && lastIndex < html.length) {
		const text = html.slice(lastIndex);
		if (text) stack[stack.length - 1].children.push(t.jsxText(text));
	}

	while (stack.length > 1) {
		const frame = stack.pop();
		const attributes = parseHtmlAttributesToJsx(frame.rawAttrs);
		stack[stack.length - 1].children.push(
			t.jsxElement(
				t.jsxOpeningElement(t.jsxIdentifier(frame.tag), attributes),
				t.jsxClosingElement(t.jsxIdentifier(frame.tag)),
				frame.children
			)
		);
	}

	return result;
}

/**
 * Merges or creates a JSX `style={{ ... }}` object on the opening element.
 * An empty-string value means the editor removed the inline property, so the
 * matching JSX style entry is dropped instead of written as `prop: ""`.
 *
 * @param {import('@babel/types').JSXOpeningElement} openingElement
 * @param {Record<string, string>} styleObject
 * @returns {void}
 */
function setJsxStyleProperty(openingElement, styleObject) {
	const existing = openingElement.attributes.find(attribute =>
		t.isJSXAttribute(attribute) && attribute.name?.name === 'style'
	);
	if (existing && t.isJSXExpressionContainer(existing.value) && t.isObjectExpression(existing.value.expression)) {
		const properties = existing.value.expression.properties;
		for (const [key, value] of Object.entries(styleObject)) {
			const propertyIndex = properties.findIndex(property =>
				t.isObjectProperty(property) && t.isIdentifier(property.key) && property.key.name === key
			);
			if (!value) {
				if (propertyIndex !== -1) properties.splice(propertyIndex, 1);
			} else if (propertyIndex !== -1) {
				properties[propertyIndex].value = t.stringLiteral(value);
			} else {
				properties.push(t.objectProperty(t.identifier(key), t.stringLiteral(value)));
			}
		}
	} else if (!existing) {
		const properties = Object.entries(styleObject)
			.filter(([, value]) => !!value)
			.map(([key, value]) => t.objectProperty(t.identifier(key), t.stringLiteral(value)));
		if (properties.length === 0) return;
		openingElement.attributes.push(
			t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(t.objectExpression(properties)))
		);
	}
}

/**
 * Parse + validate every draftKey; group valid edits by absolute file path;
 * push error entries for invalid ones.
 * @param {Record<string, object>} draft
 * @returns {{ editsByFile: Map<string, object[]>, results: object[] }}
 */
export function groupEditsByFile(draft) {
	const results = [];
	const editsByFile = new Map();

	for (const [draftKey, edit] of Object.entries(draft)) {
		let editId = draftKey;
		const atIndex = editId.indexOf('@');
		if (atIndex >= 0) editId = editId.slice(0, atIndex);

		const parsedId = parseEditId(editId);
		if (!parsedId) {
			results.push({ draftKey, success: false, error: 'Invalid editId format' });
			continue;
		}

		const validation = validateFilePath(parsedId.filePath);
		if (!validation.isValid) {
			results.push({ draftKey, success: false, error: validation.error });
			continue;
		}

		if (!editsByFile.has(validation.absolutePath)) {
			editsByFile.set(validation.absolutePath, []);
		}
		editsByFile.get(validation.absolutePath).push({ draftKey, editId, edit, parsedId });
	}

	return { editsByFile, results };
}

/**
 * Find the JSX opening element and apply the edit (image src, link attr, or text content).
 * @param {object} babelAst
 * @param {object} edit
 * @param {{ filePath: string, line: number, column: number }} parsedId
 * @returns {{ modified: true }|{ modified: false, error: string }}
 */
export function applyElementEdit(babelAst, edit, parsedId) {
	const targetNodePath = findJSXElementAtPosition(babelAst, parsedId.line, parsedId.column + 1);
	if (!targetNodePath) return { modified: false, error: 'Target node not found' };

	const targetOpeningElement = targetNodePath.node;
	const parentElementNode = targetNodePath.parentPath?.node;
	const isImageElement = targetOpeningElement.name && targetOpeningElement.name.name === 'img';

	if (isImageElement) {
		const srcAttribute = targetOpeningElement.attributes.find(attribute =>
			t.isJSXAttribute(attribute) && attribute.name && attribute.name.name === 'src'
		);
		if (srcAttribute && t.isStringLiteral(srcAttribute.value)) {
			srcAttribute.value = t.stringLiteral(edit.currentValue);
			return { modified: true };
		}
		return { modified: false, error: 'Could not apply change to AST' };
	}

	if (edit.attribute === 'href' || edit.attribute === 'to') {
		const attributeName = edit.attribute;
		const existingAttribute = targetOpeningElement.attributes.find(attribute =>
			t.isJSXAttribute(attribute) && attribute.name && attribute.name.name === attributeName
		);
		const newLiteral = t.stringLiteral(edit.currentValue ?? '');
		if (!existingAttribute) {
			targetOpeningElement.attributes.push(t.jsxAttribute(t.jsxIdentifier(attributeName), newLiteral));
			return { modified: true };
		}
		if (t.isStringLiteral(existingAttribute.value)) {
			existingAttribute.value = newLiteral;
			return { modified: true };
		}
		if (t.isJSXExpressionContainer(existingAttribute.value) && t.isStringLiteral(existingAttribute.value.expression)) {
			existingAttribute.value = newLiteral;
			return { modified: true };
		}
		return { modified: false, error: `Cannot write '${attributeName}' — source value is not a static string literal` };
	}

	if (parentElementNode && t.isJSXElement(parentElementNode)) {
		// Preserve self-closing capital-letter components (icons) from the original
		// children — they cannot be reconstructed from the saved innerHTML.
		const preservedIcons = parentElementNode.children.filter(child =>
			t.isJSXElement(child)
			&& child.openingElement.selfClosing
			&& child.openingElement.name?.name
			&& /^[A-Z]/.test(child.openingElement.name.name)
		);
		const newTextChildren = edit.currentValue && edit.currentValue.trim() !== ''
			? buildChildrenFromText(edit.currentValue)
			: [];
		parentElementNode.children = [...preservedIcons, ...newTextChildren];
		if (edit.style) setJsxStyleProperty(parentElementNode.openingElement, edit.style);
		return { modified: true };
	}

	return { modified: false, error: 'Could not apply change to AST' };
}

/**
 * Strip any lingering data-edit-* attributes from the AST, generate new source,
 * write to disk, and return the result entry for the API response.
 *
 * @param {object} babelAst
 * @param {string} absoluteFilePath
 * @param {string} originalContent
 * @returns {{ filePath: string, newFileContent: string }}
 */
export function writeBackEdits(babelAst, absoluteFilePath, originalContent) {
	// Strip any data-edit-* attributes before generating source.
	traverseBabel.default(babelAst, {
		JSXOpeningElement(openingElementPath) {
			openingElementPath.node.attributes = openingElementPath.node.attributes.filter(attribute =>
				!(t.isJSXAttribute(attribute) && typeof attribute.name?.name === 'string'
					&& attribute.name.name.startsWith('data-edit-'))
			);
		},
	});
	const webRelativeFilePath = path.relative(VITE_PROJECT_ROOT, absoluteFilePath).split(path.sep).join('/');
	const output = generateSourceWithMap(babelAst, webRelativeFilePath, originalContent);
	fs.writeFileSync(absoluteFilePath, output.code, 'utf-8');
	return { filePath: webRelativeFilePath, newFileContent: output.code };
}
