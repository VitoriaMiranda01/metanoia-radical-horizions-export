/** Selector for ancestors that use fixed/sticky positioning (affects overlay coordinates). */
export const FIXED_CONTEXT_SELECTOR = 'nav, header, [style*="position: fixed"], [style*="position:fixed"], [style*="position: sticky"], [style*="position:sticky"]';

/** CSS selector matching the floating text-format toolbar and its action panels. */
export const TOOLBAR_UI_SELECTOR = '#text-format-toolbar, #text-format-link-action, #text-format-size-action, #text-format-font-action, #text-format-color-action';

/** All floating editor UI (just the toolbar + its panels in this template). */
export const EDITOR_UI_SELECTOR = TOOLBAR_UI_SELECTOR;

/** Selector matching only static inline-edit targets. */
export const STATIC_EDIT_TARGET_SELECTOR = '[data-edit-id]';

/**
 * True while edit mode is active on the app root.
 * @returns {boolean}
 */
export function isEditModeEnabled() {
	return document.getElementById('root')?.getAttribute('data-edit-mode-enabled') === 'true';
}

/**
 * True when selection mode (assisted edits) is active — the bootstrap stays inert in that case.
 * @returns {boolean}
 */
export function isSelectionModeEnabled() {
	return document.getElementById('root')?.getAttribute('data-selection-mode-enabled') === 'true';
}

/**
 * True when the event target sits inside any floating editor UI (toolbar or action panels).
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
export function isInsideEditorUi(target) {
	return !!target?.closest?.(EDITOR_UI_SELECTOR);
}
