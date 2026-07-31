import { Z_INDEX_OVERLAY, Z_INDEX_FLOATING } from "../constants/theme.js";
import { FIXED_CONTEXT_SELECTOR } from "../constants/selectors.js";

/** True for elements that use the parent image picker (`img`, inline `svg`). */
export function isImageEditElement(element) {
	const tag = element?.tagName?.toLowerCase();
	return tag === 'img' || tag === 'svg';
}

/** Serialize inline SVG for image-picker preview (`<img src>`). */
function svgElementToDataUrl(element) {
	const clone = element.cloneNode(true);
	for (const attribute of ['data-edit-type', 'data-edit-id']) {
		clone.removeAttribute(attribute);
	}
	if (!clone.getAttribute('xmlns')) {
		clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	}
	const svgString = new XMLSerializer().serializeToString(clone);
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

/** Current value shown in the image picker. */
export function getImageEditValue(element) {
	const tag = element?.tagName?.toLowerCase();
	if (tag === 'img') {
		return element.getAttribute('src') || '';
	}
	if (tag === 'svg') {
		return svgElementToDataUrl(element);
	}
	return '';
}

/** Value stored for undo (serialized `<svg>` markup, or `<img>` src). */
export function getImageEditOldValue(element) {
	if (element?.tagName?.toLowerCase() === 'svg') {
		return element.outerHTML;
	}
	return getImageEditValue(element);
}

/**
 * Applies a picked image URL. Replaces `<svg>` with `<img>`; updates `src` on `<img>`.
 * @param {HTMLElement} element
 * @param {string} url
 * @returns {HTMLElement} The element that should be tracked in history.
 */
export function applyImageEditValue(element, url) {
	if (element?.tagName?.toLowerCase() === 'svg') {
		const image = document.createElement('img');
		image.src = url;
		if (element.className) image.className = element.className;
		const style = element.getAttribute('style');
		if (style) image.setAttribute('style', style);
		const editId = element.getAttribute('data-edit-id');
		if (editId) image.setAttribute('data-edit-id', editId);
		element.replaceWith(image);
		return image;
	}
	element.setAttribute('src', url);
	return element;
}

/**
 * Restores a prior image edit value (undo/redo). `value` is a URL or serialized `<svg>`.
 * @param {HTMLElement} element
 * @param {string} value
 */
export function restoreImageEditValue(element, value) {
	if (value.trim().startsWith('<')) {
		const template = document.createElement('template');
		template.innerHTML = value.trim();
		const restored = template.content.firstElementChild;
		if (restored) element.replaceWith(restored);
		return;
	}
	applyImageEditValue(element, value);
}

/**
 * True when the element sits inside a fixed/sticky ancestor, meaning overlays
 * must use viewport (fixed) positioning instead of document coordinates.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isInFixedContext(element) {
	return !!element.closest(FIXED_CONTEXT_SELECTOR);
}

/**
 * z-index for selection/hover overlays; elevated when inside fixed/sticky ancestors.
 * @param {HTMLElement} element
 * @returns {number}
 */
export function overlayZIndex(element) {
	return isInFixedContext(element) ? Z_INDEX_FLOATING : Z_INDEX_OVERLAY;
}

/**
 * Effective z-index of the edited element: the nearest explicit numeric z-index
 * on the element or its ancestors, so the floating toolbar shares the same
 * stacking level as the element it was opened from (rather than always sitting
 * on the top-most overlay layer). Falls back to {@link overlayZIndex} when no
 * ancestor declares a numeric z-index.
 * @param {HTMLElement} element
 * @returns {number}
 */
export function elementZIndex(element) {
	let node = element;
	while (node && node !== document.body && node !== document.documentElement) {
		const zIndex = getComputedStyle(node).zIndex;
		if (zIndex && zIndex !== 'auto') {
			const parsed = parseInt(zIndex, 10);
			if (!Number.isNaN(parsed)) return parsed;
		}
		node = node.parentElement;
	}
	return overlayZIndex(element);
}
