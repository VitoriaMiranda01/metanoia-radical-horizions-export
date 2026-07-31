import { ParentMessage } from '../constants/messages.js';
import { undo, redo, getEditState } from '../state/history-state.js';
import { postToParent } from './parent-frame.js';

/**
 * Applies one undo/redo step and notifies the parent frame when an action ran.
 * @param {'undo'|'redo'} direction
 * @returns {object|null}
 */
function applySessionHistoryStep(direction) {
	const action = direction === 'undo' ? undo() : redo();
	if (!action) return null;

	postToParent(
		direction === 'undo' ? ParentMessage.EDIT_UNDO_APPLIED : ParentMessage.EDIT_REDO_APPLIED,
		{
			editId: action.editId,
			value: direction === 'undo' ? action.oldValue : action.newValue,
			...getEditState(),
		},
	);

	return action;
}

/** @returns {object|null} */
export function applySessionUndo() {
	return applySessionHistoryStep('undo');
}

/** @returns {object|null} */
export function applySessionRedo() {
	return applySessionHistoryStep('redo');
}
