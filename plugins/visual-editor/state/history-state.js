import { sanitizeText, patchRemoveChild } from "../utils/html-utils.js";
import { restoreImageEditValue } from "../utils/dom-utils.js";

/** Maximum undo/redo entries; oldest entry is dropped when the log exceeds this. */
const MAX_HISTORY = 25;

/** Committed and redoable edit actions for the current session. */
const actionLog = [];

/** Index of the last committed entry in `actionLog`; -1 when nothing is committed. */
let actionPointer = -1;

/** Monotonic id assigned at the start of each inline edit session. */
let nextEditSessionId = 1;

/** @returns {number} A new session id for the next inline edit burst. */
export function beginEditSession() {
	return nextEditSessionId++;
}

/** @returns {number} index of the last committed entry; -1 if nothing committed */
export function getActionPointer() {
	return actionPointer;
}

/** @returns {number} total entries in the log, including undone future entries */
export function getActionLogLength() {
	return actionLog.length;
}

/** Wipes all undo/redo history (e.g. on discard or new session). */
export function clearHistory() {
	actionLog.length = 0;
	actionPointer = -1;
	nextEditSessionId = 1;
}

/**
 * Stable deduplication key for an action.
 * @param {{ editId: string, attribute?: string|null }} action
 * @returns {string}
 */
export function getActionKey(action) {
	const attributeSuffix = action.attribute ? `@${action.attribute}` : '';
	return `${action.editId}${attributeSuffix}`;
}

/**
 * Resolves the DOM element for an action. Prefers the stored element reference
 * (survives HMR position shifts), falls back to querying by the current
 * data-edit-id attribute.
 * @param {object} action
 * @returns {HTMLElement|null}
 */
function resolveElement(action) {
	if (action.element?.isConnected) return action.element;
	return document.querySelector(`[data-edit-id="${action.editId}"]`);
}

/**
 * Finds the DOM element for an edit and writes a value to it (used by undo/redo).
 * @param {object} action - The history action entry (has element ref + editId).
 * @param {string} value
 */
function applyValueToElement(action, value) {
	const element = resolveElement(action);
	if (!element) return;

	if (action.attribute) {
		element.setAttribute(action.attribute === 'to' ? 'href' : action.attribute, value || "");
		return;
	}

	if (action.replaceSvg) {
		restoreImageEditValue(element, value);
		return;
	}

	if (element.tagName.toLowerCase() === "img") {
		element.setAttribute("src", value);
	} else {
		patchRemoveChild(element);
		element.innerHTML = value;
	}
}

/**
 * Applies element-level inline style props for undo/redo. Setting a prop to ''
 * removes the inline value so CSS-class styling takes over again.
 * @param {object} action - The history action entry.
 * @param {object|null} styleProperties - camelCase property → value (or '' to clear)
 */
function applyStyleToElement(action, styleProperties) {
	if (!styleProperties) return;
	const element = resolveElement(action);
	if (!element) return;
	for (const [key, value] of Object.entries(styleProperties)) {
		element.style[key] = value || '';
	}
}

/**
 * Records an edit, coalescing within a single edit session: while an element's
 * entry is the most recent committed action AND shares the same sessionId,
 * further changes to that element (text, color, alignment, …) amend the same
 * entry in place — keeping its original oldValue/oldStyle — so the whole burst
 * undoes/redoes as ONE step. A new entry is pushed when a different element was
 * edited in between, after undo, or when a new edit session starts on the same
 * element. Attribute edits (e.g. href) are keyed separately via {@link getActionKey}.
 *
 * @param {string} editId
 * @param {string} oldValue
 * @param {string} newValue
 * @param {object} [options]
 * @param {object|null} [options.style] - Net element-level style props applied.
 * @param {object|null} [options.oldStyle] - Previous inline values of those props ('' = unset).
 * @param {string|null} [options.attribute]
 * @param {HTMLElement|null} [options.element]
 * @param {number|null} [options.sessionId] - Inline edit session; coalesces only when equal.
 * @param {boolean} [options.replaceSvg]
 */
export function recordEdit(editId, oldValue, newValue, { style = null, oldStyle = null, attribute = null, element = null, sessionId = null, replaceSvg = false } = {}) {
	const composite = getActionKey({ editId, attribute });
	const lastForEdit = [...actionLog].slice(0, actionPointer + 1).findLast(action => getActionKey(action) === composite);
	if (lastForEdit && lastForEdit.newValue === newValue && !style) return;

	if (lastForEdit
		&& actionLog.lastIndexOf(lastForEdit) === actionPointer
		&& lastForEdit.sessionId === sessionId) {
		lastForEdit.newValue = newValue;
		if (style) {
			lastForEdit.style = { ...lastForEdit.style, ...style };
			// Keep the earliest captured old values so a single undo restores
			// the element to its true pre-edit state.
			lastForEdit.oldStyle = { ...oldStyle, ...lastForEdit.oldStyle };
		}
		if (element) lastForEdit.element = element;
		return;
	}

	actionLog.length = actionPointer + 1;
	actionLog.push({ editId, oldValue, newValue, style, oldStyle, attribute, element, sessionId, replaceSvg });

	if (actionLog.length > MAX_HISTORY) {
		actionLog.shift();
	}

	actionPointer = actionLog.length - 1;
}

/**
 * Reverts the most recent committed edit (content and element-level styles)
 * and moves the pointer back.
 * @returns {{ editId: string, oldValue: string, newValue: string }|null}
 */
export function undo() {
	if (actionPointer < 0) return null;
	const action = actionLog[actionPointer];
	applyValueToElement(action, action.oldValue);
	if (action.style) {
		const revert = {};
		for (const key of Object.keys(action.style)) {
			revert[key] = action.oldStyle?.[key] ?? '';
		}
		applyStyleToElement(action, revert);
	}
	actionPointer--;
	return action;
}

/**
 * Re-applies the next undone edit (content and element-level styles) and
 * advances the pointer.
 * @returns {{ editId: string, oldValue: string, newValue: string }|null}
 */
export function redo() {
	if (actionPointer >= actionLog.length - 1) return null;
	actionPointer++;
	const action = actionLog[actionPointer];
	applyValueToElement(action, action.newValue);
	applyStyleToElement(action, action.style);
	return action;
}

/**
 * Aggregates the committed log into one draft per target: the first entry for a key
 * captures the original value/style, later entries advance the current value/style.
 * @returns {Map<string, { attribute: string|null, originalValue: string, currentValue: string, originalStyle: Record<string, string>, currentStyle: Record<string, string> }>}
 */
function collectEditDrafts() {
	const draftsByKey = new Map();
	for (let index = 0; index <= actionPointer; index++) {
		const action = actionLog[index];
		const key = getActionKey(action);
		let draft = draftsByKey.get(key);
		if (!draft) {
			draft = {
				attribute: action.attribute ?? null,
				originalValue: action.oldValue,
				currentValue: action.newValue,
				originalStyle: {},
				currentStyle: {},
			};
			draftsByKey.set(key, draft);
		}
		draft.currentValue = action.newValue;
		for (const [property, value] of Object.entries(action.style ?? {})) {
			// Keep the earliest original so a later revert is detectable.
			if (!(property in draft.originalStyle)) {
				draft.originalStyle[property] = action.oldStyle?.[property] ?? '';
			}
			draft.currentStyle[property] = value;
		}
	}
	return draftsByKey;
}

/**
 * Collapses the committed log into one net edit per target. Values or style props
 * edited back to their original are dropped, so an element reverted to its starting
 * state yields no edit.
 * @returns {Record<string, { originalValue: string, currentValue: string, style?: object, attribute?: string }>}
 */
export function getCurrentEdits() {
	const edits = {};
	for (const [key, draft] of collectEditDrafts()) {
		const isTextEdit = !draft.attribute;
		const originalValue = isTextEdit ? sanitizeText(draft.originalValue) : draft.originalValue;
		const currentValue = isTextEdit ? sanitizeText(draft.currentValue) : draft.currentValue;

		const style = {};
		for (const property of Object.keys(draft.currentStyle)) {
			if ((draft.currentStyle[property] ?? '') !== (draft.originalStyle[property] ?? '')) {
				style[property] = draft.currentStyle[property] ?? '';
			}
		}

		const hasStyleChange = Object.keys(style).length > 0;
		if (currentValue === originalValue && !hasStyleChange) continue;

		const edit = { originalValue, currentValue };
		if (draft.attribute) edit.attribute = draft.attribute;
		if (hasStyleChange) edit.style = style;
		edits[key] = edit;
	}
	return edits;
}

/**
 * Undo/redo availability plus the count of distinct elements that still differ
 * from their original. Derived from getCurrentEdits so it can't drift from what
 * gets persisted.
 * @returns {{ canUndo: boolean, canRedo: boolean, editedElementsCount: number }}
 */
export function getEditState() {
	const changedElementIds = new Set(
		Object.keys(getCurrentEdits()).map(key => key.split('@')[0]),
	);
	return {
		canUndo: actionPointer >= 0,
		canRedo: actionPointer < actionLog.length - 1,
		editedElementsCount: changedElementIds.size,
	};
}
