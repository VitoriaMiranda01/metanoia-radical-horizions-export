/** Injected CSS for edit-mode outlines, contenteditable affordances, and the disabled tooltip. */
export const EDIT_MODE_STYLES = `
	#root[data-edit-mode-enabled="true"] {
		cursor: pointer;
	}

	#root[data-edit-mode-enabled="true"] [data-edit-id] {
		cursor: pointer;
		outline: 2px dashed #357DF9;
		outline-offset: 2px;
		min-height: 1em;
		overflow-wrap: anywhere;
		min-width: 0;
	}
	#root[data-edit-mode-enabled="true"] img[data-edit-id] {
		outline-offset: -2px;
	}
	#root[data-edit-mode-enabled="true"] [data-edit-id]:hover {
		background-color: #357DF933;
		outline-color: #357DF9;
	}
	#root[data-edit-mode-enabled="true"] [data-edit-id][contenteditable="true"] {
		outline-style: solid;
		caret-color: currentColor;
		user-select: text;
		-webkit-user-select: text;
	}

	/* Block navigation / activation on actionable elements while editing. */
	#root[data-edit-mode-enabled="true"] a,
	#root[data-edit-mode-enabled="true"] button,
	#root[data-edit-mode-enabled="true"] [role="button"],
	#root[data-edit-mode-enabled="true"] [type="submit"] {
		pointer-events: none !important;
	}
	/* …but editable and disabled targets keep receiving clicks/hover. */
	#root[data-edit-mode-enabled="true"] [data-edit-id],
	#root[data-edit-mode-enabled="true"] [data-edit-disabled] {
		pointer-events: auto !important;
	}

	@keyframes fadeInTooltip {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	#inline-editor-disabled-tooltip {
		display: none;
		opacity: 0;
		position: absolute;
		background-color: #1D1E20;
		color: white;
		padding: 4px 8px;
		border-radius: 8px;
		z-index: 10001;
		font-size: 14px;
		border: 1px solid #3B3D4A;
		max-width: 184px;
		text-align: center;
	}

	#inline-editor-disabled-tooltip.tooltip-active {
		display: block;
		animation: fadeInTooltip 0.2s ease-out forwards;
	}
`;
