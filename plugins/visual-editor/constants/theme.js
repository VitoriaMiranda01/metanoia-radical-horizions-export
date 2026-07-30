/** Visual design tokens (colors, z-index, shadows) for the editor UI. */

/** Background color for floating panels and toolbars. */
export const PANEL_BG = '#1D1E20';
/** Border color for panel borders and dividers. */
export const BORDER_COLOR = '#3B3D4A';
/** Translucent white border (#fff at 20% opacity) for subtle on-dark outlines. */
export const BORDER_COLOR_TRANSLUCENT = '#ffffff33';
/** Border color for focused inputs: a touch brighter than the default, not white. */
export const BORDER_COLOR_FOCUS = '#6B6E7E';
/** Subtle hover background for interactive panel controls. */
export const HOVER_BG = '#ffffff0d';
/** Active/pressed background for panel controls. */
export const ACTIVE_BG = '#2a2b2f';
/** Default foreground color on dark panels. */
export const COLOR_WHITE = '#ffffff';
/** Placeholder text color in panel inputs. */
export const PLACEHOLDER_COLOR = '#D1D5DC';

/** z-index for selection/hover overlays and labels in normal flow. */
export const Z_INDEX_OVERLAY = 999;
/** z-index for floating overlays inside fixed/sticky ancestors, panels, and toolbars. */
export const Z_INDEX_FLOATING = 99999;

/** Box shadow for dropdown panels. */
export const BOX_SHADOW_DROPDOWN = '0 4px 16px 0 rgba(0, 0, 0, 0.30)';
/** Box shadow for inline formatting toolbars. */
export const BOX_SHADOW_TOOLBAR = '0 1px 4px 0 rgba(0, 0, 0, 0.10)';
