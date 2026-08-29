import { startInlineEdit, commitCurrentEdit, placeCursorAtPoint } from "./ui/inline-edit/edit-action.js";
import { getEditing } from "./state/editing-state.js";
import { isImageEditElement, getImageEditValue, getImageEditOldValue, applyImageEditValue } from "./utils/dom-utils.js";
import { postToParent } from "./utils/parent-frame.js";
import { ParentMessage, ChildMessage } from "./constants/messages.js";
import { isEditModeEnabled, isSelectionModeEnabled, isInsideEditorUi } from "./constants/selectors.js";
import { recordEdit, getEditState } from "./state/history-state.js";
import { applySessionUndo, applySessionRedo } from "./utils/session-history-command.js";
import { handleDraftSave, handleDraftDiscard, discardAllEdits } from "./api/draft.js";
import { patchReactDomMutations } from "./utils/html-utils.js";

let disabledTooltipElement = null;
let currentDisabledHoverElement = null;
let globalClickHandler = null;

/** Tracks the element behind the parent image picker (back-compat `edit-save` flow). */
let currentImageEdit = null;

let translations = {
	disabledTooltipText: "This text can be changed only through chat.",
	disabledTooltipTextImage: "This image can only be changed through chat.",
};

/* ------------------------------------------------------------------ *
 * Editable target lookup
 * ------------------------------------------------------------------ */

function findEditableElementAtPoint(event) {
	const direct = event.target.closest("[data-edit-id]");
	if (direct) return direct;

	const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
	const found = elementsAtPoint.find(
		(element) => element !== event.target && element.hasAttribute("data-edit-id")
	);
	return found || null;
}

function findDisabledElementAtPoint(event) {
	const direct = event.target.closest("[data-edit-disabled]");
	if (direct) return direct;
	const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
	const found = elementsAtPoint.find(
		(element) => element !== event.target && element.hasAttribute("data-edit-disabled")
	);
	return found || null;
}

/* ------------------------------------------------------------------ *
 * Image edit (parent picker) — kept as the existing message contract
 * ------------------------------------------------------------------ */

function startImageEdit(targetElement, editId) {
	currentImageEdit = { editId, targetElement };
	postToParent(ParentMessage.IMAGE_EDIT_ENTER, { currentText: getImageEditValue(targetElement) });
}

/**
 * Dismisses an active image selection and tells the parent to close the image
 * picker popup (e.g. when the user clicks away to another element or empty space).
 */
function cancelImageEdit() {
	if (!currentImageEdit) return;
	currentImageEdit = null;
	postToParent(ParentMessage.EDIT_CANCEL, {});
}

/**
 * The parent image picker drives image replacement via `edit-save`. The change
 * is applied to the live DOM and recorded in history; it is written to source
 * only on an explicit draft save.
 */
function handleImageEditSave(newText) {
	if (!currentImageEdit) return;
	const { editId, targetElement } = currentImageEdit;
	const replaceSvg = targetElement.tagName.toLowerCase() === "svg";
	const oldValue = getImageEditOldValue(targetElement);
	const newValue = newText ?? "";
	const updatedElement = applyImageEditValue(targetElement, newValue);
	currentImageEdit.targetElement = updatedElement;
	recordEdit(editId, oldValue, newValue, { element: updatedElement, replaceSvg });
	postToParent(ParentMessage.EDIT_STATE_CHANGED, { ...getEditState() });
}

/* ------------------------------------------------------------------ *
 * Click routing
 * ------------------------------------------------------------------ */

function handleClick(event) {
	if (!isEditModeEnabled() || isSelectionModeEnabled()) return;
	if (isInsideEditorUi(event.target)) return;

	const editing = getEditing();

	if (editing?.targetElement?.hasAttribute("contenteditable") && editing.targetElement.contains(event.target)) {
		const link = event.target.closest?.("a");
		if (link && editing.targetElement.contains(link)) {
			event.preventDefault();
			if (event.detail <= 1) {
				placeCursorAtPoint(event.clientX, event.clientY, editing.targetElement);
			}
		}
		return;
	}

	const editable = findEditableElementAtPoint(event);

	if (editable) {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();

		const editId = editable.getAttribute("data-edit-id");
		if (!editId) return;

		if (isImageEditElement(editable)) {
			if (editing) commitCurrentEdit();
			startImageEdit(editable, editId);
			return;
		}

		if (editing && editing.targetElement !== editable) {
			commitCurrentEdit();
		}
		// Switching to a text element: drop any pending image selection so its
		// picker popup doesn't linger alongside the text toolbar.
		currentImageEdit = null;
		startInlineEdit(editable, editId, editable.innerHTML || "");
		return;
	}

	// Click outside any editable target: commit the active edit and block
	// default navigation/submission for actionable elements.
	if (editing) {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		commitCurrentEdit();
		return;
	}

	// Clicking empty/non-editable space while an image is selected closes its picker.
	cancelImageEdit();

	if (event.target.closest("a[href], button, [role='button'], [type='submit']")) {
		event.preventDefault();
	}
}

/* ------------------------------------------------------------------ *
 * Disabled-element hover tooltip (unchanged behavior)
 * ------------------------------------------------------------------ */

function createDisabledTooltip() {
	if (disabledTooltipElement) return;
	disabledTooltipElement = document.createElement("div");
	disabledTooltipElement.id = "inline-editor-disabled-tooltip";
	document.body.appendChild(disabledTooltipElement);
}

function showDisabledTooltip(targetElement, isImage = false) {
	if (!disabledTooltipElement) createDisabledTooltip();

	disabledTooltipElement.textContent = isImage
		? translations.disabledTooltipTextImage
		: translations.disabledTooltipText;

	if (!disabledTooltipElement.isConnected) {
		document.body.appendChild(disabledTooltipElement);
	}
	disabledTooltipElement.classList.add("tooltip-active");

	const tooltipWidth = disabledTooltipElement.offsetWidth;
	const tooltipHeight = disabledTooltipElement.offsetHeight;
	const bounds = targetElement.getBoundingClientRect();

	// Ensures that tooltip is not off the screen with 5px margin
	let newLeft = bounds.left + window.scrollX + bounds.width / 2 - tooltipWidth / 2;
	let newTop = bounds.bottom + window.scrollY + 5;

	if (newLeft < window.scrollX) {
		newLeft = window.scrollX + 5;
	}
	if (newLeft + tooltipWidth > window.innerWidth + window.scrollX) {
		newLeft = window.innerWidth + window.scrollX - tooltipWidth - 5;
	}
	if (newTop + tooltipHeight > window.innerHeight + window.scrollY) {
		newTop = bounds.top + window.scrollY - tooltipHeight - 5;
	}
	if (newTop < window.scrollY) {
		newTop = window.scrollY + 5;
	}

	disabledTooltipElement.style.left = `${newLeft}px`;
	disabledTooltipElement.style.top = `${newTop}px`;
}

function hideDisabledTooltip() {
	if (disabledTooltipElement) {
		disabledTooltipElement.classList.remove("tooltip-active");
	}
}

function handleDisabledGlobalHover(event) {
	const disabledElement = findDisabledElementAtPoint(event);
	if (disabledElement) {
		if (currentDisabledHoverElement !== disabledElement) {
			currentDisabledHoverElement = disabledElement;
			showDisabledTooltip(disabledElement, disabledElement.tagName.toLowerCase() === "img");
		}
	} else if (currentDisabledHoverElement) {
		currentDisabledHoverElement = null;
		hideDisabledTooltip();
	}
}

/* ------------------------------------------------------------------ *
 * Undo / redo keyboard shortcuts
 * ------------------------------------------------------------------ */

/** True for native text-editing surfaces where the browser should own undo. */
function isNativeEditingContext(target) {
	if (!target) return false;
	const tag = target.tagName?.toLowerCase();
	return tag === "input" || tag === "textarea" || !!target.isContentEditable;
}

function handleHistoryKeydown(event) {
	if (!isEditModeEnabled() || isSelectionModeEnabled()) return;
	if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;

	// While an inline edit is active, let the browser handle native text undo
	// inside the contenteditable region instead of stepping the edit history.
	if (getEditing()?.targetElement?.hasAttribute("contenteditable") || isNativeEditingContext(event.target)) {
		return;
	}

	event.preventDefault();
	if (event.shiftKey) {
		applySessionRedo();
	} else {
		applySessionUndo();
	}
}

/* ------------------------------------------------------------------ *
 * Enable / disable edit mode
 * ------------------------------------------------------------------ */

function enableEditMode() {
	// Don't enable while selection mode (assisted edits) owns the surface.
	if (isSelectionModeEnabled()) {
		console.warn("[EDIT MODE] Cannot enable edit mode while selection mode is active");
		return;
	}

	// Guard React reconciliation before any inline edit rewrites DOM subtrees.
	patchReactDomMutations();

	document.getElementById("root")?.setAttribute("data-edit-mode-enabled", "true");

	if (!globalClickHandler) {
		globalClickHandler = handleClick;
		document.addEventListener("click", globalClickHandler, true);
	}

	document.addEventListener("mousemove", handleDisabledGlobalHover, true);
	document.addEventListener("keydown", handleHistoryKeydown, true);

	postToParent(ParentMessage.EDIT_STATE_CHANGED, { ...getEditState() });
}

function disableEditMode() {
	const editing = getEditing();
	if (editing?.targetElement?.hasAttribute("contenteditable")) {
		commitCurrentEdit();
	}

	document.getElementById("root")?.removeAttribute("data-edit-mode-enabled");

	hideDisabledTooltip();
	currentDisabledHoverElement = null;
	currentImageEdit = null;

	if (globalClickHandler) {
		document.removeEventListener("click", globalClickHandler, true);
		globalClickHandler = null;
	}

	document.removeEventListener("mousemove", handleDisabledGlobalHover, true);
	document.removeEventListener("keydown", handleHistoryKeydown, true);

	discardAllEdits();
	postToParent(ParentMessage.EDIT_STATE_CHANGED, { ...getEditState() });
}

/* ------------------------------------------------------------------ *
 * Parent <-> iframe messaging
 * ------------------------------------------------------------------ */

window.addEventListener("message", function (event) {
	if (event.data?.type === ChildMessage.ENABLE_EDIT_MODE) {
		if (event.data?.translations) {
			translations = { ...translations, ...event.data.translations };
		}
		enableEditMode();
	}

	if (event.data?.type === ChildMessage.DISABLE_EDIT_MODE) {
		disableEditMode();
	}

	// Text editing now happens in-iframe via contenteditable; `edit-save` only
	// remains to keep the existing parent-driven image picker working.
	if (event.data?.type === ChildMessage.EDIT_SAVE) {
		handleImageEditSave(event.data?.payload?.newText);
	}

	if (event.data?.type === ChildMessage.DRAFT_SAVE) {
		handleDraftSave();
	}

	if (event.data?.type === ChildMessage.DRAFT_DISCARD) {
		handleDraftDiscard();
	}

	if (event.data?.type === ChildMessage.EDIT_UNDO) {
		applySessionUndo();
	}

	if (event.data?.type === ChildMessage.EDIT_REDO) {
		applySessionRedo();
	}
});
