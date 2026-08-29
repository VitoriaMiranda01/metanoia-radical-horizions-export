/**
 * Decodes HTML entity-encoded characters back to their literal form.
 * @param {string} string
 * @returns {string}
 */
export function decodeHtmlEntities(string) {
	return string
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

/**
 * Converts a kebab-case CSS property name to camelCase.
 * @param {string} property
 * @returns {string}
 */
export function cssPropToCamel(property) {
	return property.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

/**
 * Escapes HTML special characters in a plain string (used to build safe HTML markup).
 * @param {string} string
 * @returns {string}
 */
export function escapeHtml(string) {
	return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Strips inline HTML tags from text, converting <br> to newlines.
 * @param {string} text
 * @returns {string}
 */
export function stripInlineTags(text) {
	if (typeof text !== "string") return "";
	return text
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/?(strong|em|b|i|u|a|span)\b[^>]*>/gi, "");
}

/**
 * Returns the next node in document order within `root`, or null at the end.
 * @param {Node} node
 * @param {Node} root
 * @returns {Node|null}
 */
function nextNodeInFlow(node, root) {
	if (node.firstChild) return node.firstChild;
	let current = node;
	while (current && current !== root) {
		if (current.nextSibling) return current.nextSibling;
		current = current.parentNode;
	}
	return null;
}

/**
 * Whether a text node sits at the end of a line: nothing follows it, or the next
 * node in flow is a <br>. Only such trailing spaces get collapsed by the browser
 * on re-parse and need preserving — spaces between inline siblings (e.g. coloured
 * <span> words) must stay normal breaking spaces or the line can't wrap.
 * @param {Node} node
 * @param {Node} root
 * @returns {boolean}
 */
function isAtLineEnd(node, root) {
	const next = nextNodeInFlow(node, root);
	if (!next) return true;
	let candidate = next;
	while (candidate && candidate.nodeType === Node.ELEMENT_NODE) {
		if (candidate.tagName.toLowerCase() === 'br') return true;
		candidate = candidate.firstChild;
	}
	return false;
}

/**
 * Replaces line-end trailing keyboard spaces in text nodes with U+00A0 so innerHTML
 * round-trips preserve them (browsers drop trailing U+0020 on re-parse). Spaces
 * between inline siblings are left intact so the content can still wrap.
 * @param {Node} root
 */
function preserveTrailingSpacesInTextNodes(root) {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		textNodes.push(node);
	}
	for (const node of textNodes) {
		const text = node.nodeValue ?? '';
		if (!/ $/.test(text) || !isAtLineEnd(node, root)) continue;
		node.nodeValue = text.replace(/ +$/g, (spaces) => '\u00a0'.repeat(spaces.length));
	}
}

/**
 * Reads contenteditable markup from the live DOM after keyboard input, preserving
 * trailing spaces that `innerHTML` alone would drop on commit.
 * @param {HTMLElement} element
 * @returns {string}
 */
export function serializeContentEditableHtml(element) {
	if (!element) return '';
	const clone = element.cloneNode(true);
	preserveTrailingSpacesInTextNodes(clone);
	return normalizeContentEditableHtml(clone.innerHTML);
}

/**
 * Normalises contenteditable innerHTML into a canonical form by collapsing
 * Chrome's <div>-based line wrapping back into <br> separators.
 * Intentionally keeps `&nbsp;` entities so keyboard-typed trailing spaces persist.
 * @param {string} html
 * @returns {string}
 */
export function normalizeContentEditableHtml(html) {
	if (typeof html !== "string") return "";
	return html
		.replace(/<div><br\s*\/?><\/div>/gi, "<br>")
		.replace(/<br\s*\/?>\s*(?=<div>)/gi, "")
		.replace(/<div>/gi, "<br>")
		.replace(/<\/div>/gi, "")
		.replace(/^<br>/, "");
}

/**
 * Guards against "Failed to execute 'removeChild'" when innerHTML is set
 * while a browser async task still holds a reference to a child node.
 * @param {HTMLElement} element
 */
export function patchRemoveChild(element) {
	if (element.__removeChildPatched) return;
	const original = element.removeChild;
	element.removeChild = function (child) {
		if (child.parentNode !== this) return child;
		return original.call(this, child);
	};
	element.__removeChildPatched = true;
}

let reactDomMutationsPatched = false;

/**
 * Inline edits rewrite a target element's subtree via `innerHTML`, which orphans
 * the DOM nodes React still references in its fiber tree (including *nested*
 * nodes like <em>/<strong> inside an edited <h1>). On its next render React then
 * calls `removeChild`/`insertBefore` against nodes that are no longer where it
 * expects, throwing "The node to be removed is not a child of this node".
 *
 * Patching the per-element `removeChild` only covers the edit target, not its
 * descendants, so we guard the prototypes once instead: mismatched removals
 * become no-ops and mismatched insertions fall back to an append, letting React
 * reconcile to the correct state on the next render. Idempotent.
 */
export function patchReactDomMutations() {
	if (reactDomMutationsPatched) return;
	reactDomMutationsPatched = true;

	const originalRemoveChild = Node.prototype.removeChild;
	Node.prototype.removeChild = function (child) {
		if (child && child.parentNode !== this) return child;
		return originalRemoveChild.call(this, child);
	};

	const originalInsertBefore = Node.prototype.insertBefore;
	Node.prototype.insertBefore = function (newNode, referenceNode) {
		if (referenceNode && referenceNode.parentNode !== this) {
			return originalInsertBefore.call(this, newNode, null);
		}
		return originalInsertBefore.call(this, newNode, referenceNode);
	};
}

/**
 * Escapes raw HTML characters while preserving allowed inline tags
 * (strong, em, a, span, br, etc.) so user content is safe to inject into the DOM.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeText(text) {
	if (typeof text !== "string") return "";
	const normalized = normalizeContentEditableHtml(text);
	const preserved = [];
	let result = normalized.replace(/<(\/?)(?:strong|em|b|i|u|a|span|br)\b[^>]*\/?>/gi, (match) => {
		preserved.push(match);
		return `\x00ITAG${preserved.length - 1}\x00`;
	});
	result = result
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/{/g, "&#123;")
		.replace(/}/g, "&#125;");
	result = result.replace(/\x00ITAG(\d+)\x00/g, (_, index) => preserved[parseInt(index)]);
	return result;
}
