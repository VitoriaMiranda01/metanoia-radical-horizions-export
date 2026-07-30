import { ParentMessage } from "../constants/messages.js";
import { postToParent } from "../utils/parent-frame.js";
import { getEditing } from "../state/editing-state.js";
import { getCurrentEdits, clearHistory, getEditState, getActionPointer } from "../state/history-state.js";
import { applySessionUndo } from "../utils/session-history-command.js";
import { commitCurrentEdit } from "../ui/inline-edit/edit-action.js";

/** Relative URL used to persist draft edits to the server. */
const DRAFT_SAVE_API_URL = "/api/draft-save";
/** Minimum duration (ms) the parent loading indicator stays visible during draft save. */
const MIN_LOADING_DISPLAY_MS = 500;

/**
 * Rolls back every committed edit in the history stack and clears it, returning
 * the document to its pre-edit state.
 */
export function discardAllEdits() {
	while (getActionPointer() >= 0) {
		applySessionUndo();
	}
	clearHistory();
}

/**
 * Commits any active inline edit, rolls back all edits in the history stack,
 * and notifies the parent frame that the draft was discarded.
 */
export function handleDraftDiscard() {
	if (getEditing()?.targetElement?.hasAttribute("contenteditable")) {
		commitCurrentEdit();
	}
	discardAllEdits();
	postToParent(ParentMessage.DRAFT_DISCARDED);
}

/**
 * Persists the current draft edits to the server.
 *
 * Commits any active contenteditable edit first, then POSTs the full edit list
 * to `DRAFT_SAVE_API_URL`. Enforces a minimum loading display duration
 * (`MIN_LOADING_DISPLAY_MS`) before sending `DRAFT_SAVE_FINISHED` so the
 * parent frame's loading indicator is never invisible.
 *
 * Parent frame messages emitted:
 * - `DRAFT_SAVE_STARTED` — immediately on call
 * - `DRAFT_APPLIED` — on success, includes server results and current edit state
 * - `DRAFT_SAVE_FAILED` — on server error or network failure, includes error message
 * - `DRAFT_SAVE_FINISHED` — always, after the minimum display delay
 *
 * @returns {Promise<void>}
 */
export async function handleDraftSave() {
	if (getEditing()?.targetElement?.hasAttribute("contenteditable")) {
		commitCurrentEdit();
	}
	postToParent(ParentMessage.DRAFT_SAVE_STARTED);
	const startTime = Date.now();
	try {
		const allEdits = getCurrentEdits();
		const draft = { ...allEdits };

		const editSummary = {};
		for (const [key, edit] of Object.entries(allEdits)) {
			edit.editId = key.split("@")[0];
			editSummary[key] = edit;
		}

		const response = await fetch(DRAFT_SAVE_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ draft }),
		});

		const result = await response.json();
		if (result.success) {
			clearHistory();
			postToParent(ParentMessage.DRAFT_APPLIED, { results: result.results, editSummary, ...getEditState() });
		} else {
			postToParent(ParentMessage.DRAFT_SAVE_FAILED, { error: result.error });
			console.error(`[vite][visual-editor] Error saving draft: ${result.error}`);
		}
	} catch (error) {
		postToParent(ParentMessage.DRAFT_SAVE_FAILED, { error: error.message });
		console.error(`[vite][visual-editor] Error during draft save:`, error);
	} finally {
		const elapsed = Date.now() - startTime;
		const remaining = MIN_LOADING_DISPLAY_MS - elapsed;
		if (remaining > 0) {
			await new Promise((resolve) => setTimeout(resolve, remaining));
		}
		postToParent(ParentMessage.DRAFT_SAVE_FINISHED);
	}
}
