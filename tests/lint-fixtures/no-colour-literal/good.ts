// R-UI-001 fixture: colour arrives as a token.
import { tokens } from '@/ui/tokens';

export const surface = tokens.colour.surface;

export const overlay = tokens.colour.overlay;

export const accent = tokens.colour.accent;

// A hexadecimal number is not a colour by itself: these are the mask widths,
// and the rule stays about colour rather than about hex.
export const VISIBLE = 0xff;

export const ALL_LAYERS = 0xffff;
