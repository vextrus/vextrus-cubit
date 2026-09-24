// R-TO-014's paint: one scene onto the overlay canvas, in CSS pixels, over the sheet already drawn.
//
// It is paint and nothing else — no hit-test, no camera, no selection, no address. The canvas it
// draws on lies above `viewer-canvas` with `pointer-events: none`, so nothing here can be reached by
// a pointer even in principle (Decision I-112).
//
// Every distinction is carried by LINE rather than by hue (R-UI-060, Decision I-116): a typed view
// outlines in a dash, an untyped one solid with a diagonal hatch across it, and a grid axis is the
// drawing office's centre line. In greyscale — and for a reader who cannot separate warn from ink —
// the three still read apart. No colour is spelled here: every one arrives resolved from a token by
// the screen (I-115).
import { LEGIBLE_TEXT_PX } from "@/modules/takeoff/viewer/client";
import type { OverlayDrawnAxis, OverlayDrawnRoom, OverlayOutline, OverlayPalette, OverlayScene } from "./types";

/** Every stroke of the overlay is one hairline: the sheet's ink, not a second weight (Decision § 5). */
const HAIRLINE_PX = 1;

/** A typed view's outline, and a grid axis's centre line — the two dash patterns of Decision I-116. */
const OUTLINE_DASH: readonly number[] = [6, 4];
const AXIS_DASH: readonly number[] = [12, 3, 2, 3];

/** The hatch a view the grammar could not read wears: 45°, at this pitch, in the sheet's own ink. */
const HATCH_PITCH_PX = 8;

/** Padding inside the type chip (Decision § 1). */
const CHIP_PAD_PX = 3;

/** A void's outline: dotted, so a lift or a shaft never reads as a room outlined solid (I-647). */
const VOID_DASH: readonly number[] = [2, 3];

/**
 * How much of the sheet's ink a room's floor is washed with. The outline runs ON the wall faces the
 * architect drew in the same ink, so a line alone would vanish into them: the wash is what shows the
 * room was read, and it is the sheet's own ink at a fraction — no second hue (R-UI-060, I-115).
 */
const ROOM_WASH_ALPHA = 0.07;

/**
 * How much of a ring's diameter a bubble's lettering may run across (I-363's second ratio): the rest
 * is the ring's own clearance, so a label never touches the line it stands inside.
 */
const BUBBLE_LABEL_SPAN = 0.8;

/** What one solid line costs to set up — every stroke states its own dash rather than inheriting one. */
function strokeStyle(context: CanvasRenderingContext2D, colour: string, dash: readonly number[]): void {
  context.strokeStyle = colour;
  context.lineWidth = HAIRLINE_PX;
  context.setLineDash([...dash]);
}

/**
 * The 45° hatch across one rectangle, stroked line by line and clipped to the rectangle it fills.
 * AC-3 asks for a diagonal-line pattern stroked in the sheet's ink: lines are what it is, so lines
 * are what is drawn — and a stroked hatch needs no `CanvasPattern` to be rebuilt when the theme
 * changes, because it carries no colour of its own between frames (Decision § 6).
 */
function hatch(context: CanvasRenderingContext2D, rect: OverlayOutline["rect"], palette: OverlayPalette): void {
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  strokeStyle(context, palette.ink, []);
  context.beginPath();
  // One family of parallel 45° lines, started far enough to the left that every one of them crosses
  // the rectangle: the offset runs from minus the height so the first line enters at the top-right.
  for (let at = -rect.height; at <= rect.width; at += HATCH_PITCH_PX) {
    context.moveTo(rect.x + at, rect.y + rect.height);
    context.lineTo(rect.x + at + rect.height, rect.y);
  }
  context.stroke();
  context.restore();
}

/** One view's outline: the rectangle, dashed or hatched by what the view is. */
function outline(context: CanvasRenderingContext2D, drawn: OverlayOutline, palette: OverlayPalette): void {
  context.save();
  // One hatch, one home (I-160): a view the machine could not type and a view no affirmation act
  // names are both views that measure nothing, and the sheet says so the same way.
  if (drawn.hatched || drawn.scaleRefusal !== null) {
    strokeStyle(context, palette.warn, []);
    context.strokeRect(drawn.rect.x, drawn.rect.y, drawn.rect.width, drawn.rect.height);
    hatch(context, drawn.rect, palette);
  } else {
    strokeStyle(context, palette.ink, OUTLINE_DASH);
    context.strokeRect(drawn.rect.x, drawn.rect.y, drawn.rect.width, drawn.rect.height);
  }
  context.restore();
}

/**
 * The type a view wears, in a reader's words (R-UI-082), on a chip standing ON the outline's top-left
 * corner from OUTSIDE the box: its foot is the rectangle's top edge (I-363).
 *
 * Inside the corner it stood where a layout plan draws its first axis: on S-10 the chip sat over axis
 * 1's bubble and centre line, and the bubble — painted after it — cut the words to "Layout(1)plan".
 * Outside the box nothing of the view lies under it; the axes' overrun past the box is all it can
 * meet, and it is painted after them, so the words are never crossed. Where there is no room above
 * the box — its top at the canvas's own top — the chip stands inside the corner as it did.
 */
function outlineChip(context: CanvasRenderingContext2D, drawn: OverlayOutline, palette: OverlayPalette): void {
  // The sheet's own level of detail: a badge is never drawn smaller than it can be read, so a view
  // shrunk past its own type spelling loses the chip rather than showing an illegible one.
  if (drawn.rect.height < palette.typeSizePx || drawn.rect.width < palette.typeSizePx) return;
  context.save();
  context.font = `${palette.typeSizePx}px ${palette.mono}`;
  context.textAlign = "left";
  context.textBaseline = "top";
  const width = context.measureText(drawn.label).width + CHIP_PAD_PX * 2;
  const height = palette.typeSizePx + CHIP_PAD_PX * 2;
  const above = drawn.rect.y - height;
  const top = above >= 0 ? above : drawn.rect.y;
  context.fillStyle = palette.paper;
  context.fillRect(drawn.rect.x, top, width, height);
  strokeStyle(context, palette.ink, []);
  context.strokeRect(drawn.rect.x, top, width, height);
  context.fillStyle = palette.label;
  context.fillText(drawn.label, drawn.rect.x + CHIP_PAD_PX, top + CHIP_PAD_PX);
  context.restore();
}

/**
 * The size a bubble's label is lettered at, or null where the ring cannot hold a legible one (I-363).
 *
 * The floor is the viewer's own — `LEGIBLE_TEXT_PX`, the size the product never letters a label of its
 * own below — measured on what a label has to fit in: the ring's DIAMETER. The rule it replaces
 * dropped the label whenever the ring's RADIUS fell under 6 px, which is a 12 px ring called
 * illegible: at 1280 × 800 S-10's rings stand 10.5 px across at the fitted scale and every one of its
 * eleven bubbles was an empty ring, while the same rings at 1440 × 900 (12.1 px) were lettered. The
 * label is the `--text-12` value where the ring has room for it, and otherwise the largest size whose
 * height the diameter holds and whose width runs across no more than `BUBBLE_LABEL_SPAN` of it.
 */
function bubbleLabelSize(context: CanvasRenderingContext2D, label: string, radius: number, palette: OverlayPalette): number | null {
  const diameter = radius * 2;
  const tall = Math.min(palette.labelSizePx, diameter);
  context.font = `${tall}px ${palette.mono}`;
  const wide = context.measureText(label).width;
  const span = diameter * BUBBLE_LABEL_SPAN;
  const size = wide > span && wide > 0 ? tall * (span / wide) : tall;
  return size >= LEGIBLE_TEXT_PX ? size : null;
}

/** One axis's centre line, and the bubble at the ring it was read off. */
function axis(context: CanvasRenderingContext2D, drawn: OverlayDrawnAxis, palette: OverlayPalette): void {
  context.save();
  strokeStyle(context, palette.ink, AXIS_DASH);
  context.beginPath();
  context.moveTo(drawn.from[0], drawn.from[1]);
  context.lineTo(drawn.to[0], drawn.to[1]);
  context.stroke();
  context.restore();

  const bubble = drawn.bubble;
  if (bubble === null) return;

  context.save();
  context.beginPath();
  context.arc(bubble.centre[0], bubble.centre[1], bubble.radius, 0, Math.PI * 2);
  context.fillStyle = palette.paper;
  context.fill();
  strokeStyle(context, palette.ink, []);
  context.stroke();
  context.restore();

  // The ring still draws below the floor: the georeference is the fact, and only its lettering is
  // dropped when the ring has no room for a legible one (Decision § 1, I-363).
  context.save();
  const size = bubbleLabelSize(context, drawn.label, bubble.radius, palette);
  if (size === null) {
    context.restore();
    return;
  }
  context.font = `${size}px ${palette.mono}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = palette.label;
  context.fillText(drawn.label, bubble.centre[0], bubble.centre[1]);
  context.restore();
}

/** One ring traced as a sub-path. */
function tracePath(context: CanvasRenderingContext2D, ring: readonly (readonly [number, number])[]): void {
  const [first, ...rest] = ring;
  if (first === undefined) return;
  context.moveTo(first[0], first[1]);
  for (const point of rest) context.lineTo(point[0], point[1]);
  context.closePath();
}

/**
 * One room: a room is washed and outlined solid, a void outlined dotted, and a room whose walls do not
 * close is drawn no outline at all — there is none, and a box round it would be the bounding box L-MEA-03
 * forbids. Its chip says so instead.
 */
function room(context: CanvasRenderingContext2D, drawn: OverlayDrawnRoom, palette: OverlayPalette): void {
  if (drawn.outer.length === 0 || drawn.status === "NOT_CLOSED") return;
  context.save();
  context.beginPath();
  tracePath(context, drawn.outer);
  for (const hole of drawn.holes) tracePath(context, hole);
  if (drawn.status === "CLOSED") {
    context.globalAlpha = ROOM_WASH_ALPHA;
    context.fillStyle = palette.ink;
    context.fill("evenodd");
    context.globalAlpha = 1;
  }
  strokeStyle(context, palette.ink, drawn.status === "VOID" ? VOID_DASH : []);
  context.stroke();
  context.restore();
}

/**
 * A room's chip: its name over its area — or over what it is where it is no room — standing inside the
 * outline's top-left corner, clear of the label the architect drew. A room shrunk past the chip loses
 * the chip rather than showing one bigger than itself, except a room whose walls do not close: its
 * chip is the only mark it has, and it is lettered in the warn ink.
 */
function roomChip(context: CanvasRenderingContext2D, drawn: OverlayDrawnRoom, palette: OverlayPalette): void {
  context.save();
  context.font = `${palette.typeSizePx}px ${palette.mono}`;
  context.textAlign = "left";
  context.textBaseline = "top";
  const width = Math.max(...drawn.lines.map((line) => context.measureText(line).width)) + CHIP_PAD_PX * 2;
  const height = palette.typeSizePx * drawn.lines.length + CHIP_PAD_PX * 2;
  const unclosed = drawn.status === "NOT_CLOSED";
  if (!unclosed && drawn.outer.length > 0) {
    const xs = drawn.outer.map((point) => point[0]);
    const ys = drawn.outer.map((point) => point[1]);
    if (Math.max(...xs) - Math.min(...xs) < width + CHIP_PAD_PX * 2 || Math.max(...ys) - Math.min(...ys) < height + CHIP_PAD_PX * 2) {
      context.restore();
      return;
    }
  }
  const x = drawn.anchor[0] + (unclosed ? 0 : CHIP_PAD_PX);
  const y = drawn.anchor[1] + (unclosed ? 0 : CHIP_PAD_PX);
  context.fillStyle = palette.paper;
  context.fillRect(x, y, width, height);
  strokeStyle(context, unclosed ? palette.warn : palette.ink, []);
  context.strokeRect(x, y, width, height);
  context.fillStyle = unclosed ? palette.warn : palette.label;
  drawn.lines.forEach((line, index) => context.fillText(line, x + CHIP_PAD_PX, y + CHIP_PAD_PX + index * palette.typeSizePx));
  context.restore();
}

/**
 * One frame of the overlay: the canvas cleared, then every outline, then every axis, then every
 * outline's type chip. The order is the Decision's — the grid reads over the views it georeferences,
 * never under them, and a view's words read over the axes' overrun beside it, never crossed by it
 * (I-363: the chip stands outside the box, where no bubble is).
 *
 * The viewport is the CSS-pixel box the scene was mapped into; where a caller does not state one the
 * context's own canvas answers it. A scene whose switches are both off clears and draws nothing,
 * which is exactly what "toggling shows what the machine sees" means when both are off.
 */
export function drawOverlayScene(
  context: CanvasRenderingContext2D,
  scene: OverlayScene,
  palette: OverlayPalette,
  viewport?: { readonly width: number; readonly height: number },
): void {
  const box = viewport ?? { width: context.canvas.width, height: context.canvas.height };
  context.clearRect(0, 0, box.width, box.height);
  // The rooms first: they are what the plan's walls enclose, under the view that frames the plan.
  for (const drawn of scene.rooms ?? []) room(context, drawn, palette);
  for (const drawn of scene.outlines) outline(context, drawn, palette);
  for (const drawn of scene.axes) axis(context, drawn, palette);
  for (const drawn of scene.outlines) outlineChip(context, drawn, palette);
  for (const drawn of scene.rooms ?? []) roomChip(context, drawn, palette);
}
