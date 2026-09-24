// L-QTY-05's second and third channels at the grain of what the drawing DECLARES (s-coverage
// I-479): a view of the layout inventory whose caption names a class is a sighting of that
// class, and so is a schedule whose title names one — the partition's member-type families are read
// off exactly those schedules. The placements a partition made are its other grain, answered by
// `partition.ts` and `layout.ts`; this reader answers only what the captions say.
//
// It says what it SAW, as every channel does: a caption that names no class contributes nothing, and
// there is no absence here. Pure over the manifest's views, which the residue query reads once and
// hands to it — the same views it resolves a rail's report about a view by (B-17).
import { VIEW_TYPE_SPELLINGS } from "../../errors/transport-vocabulary";
import { classDeclarationsOf, type ManifestView } from "../declared";
import type { Sighting } from "../law";
import { sheetOf, type SightingScope } from "./scope";

/** The channel a schedule's title is read through — the partition's schedules — and every other view's. */
const PARTITION = "PARTITION" as const;
const LAYOUT = "LAYOUT" as const;

/** The view class a schedule's title stands in (L-CAD-06), read from the vocabulary's one home. */
const [, SCHEDULE] = VIEW_TYPE_SPELLINGS;

/**
 * Every class the manifest's captions declare, as sightings on no level: a caption names what a view
 * draws, never the storey it stands on, and the level of anything placed off it is the register's
 * reading (L-REG-04).
 */
export function declaredSightings(scope: SightingScope, views: readonly ManifestView[]): Sighting[] {
  return classDeclarationsOf(views).map((declaration) => ({
    class: declaration.class,
    levelId: null,
    channel: declaration.view.type === SCHEDULE ? PARTITION : LAYOUT,
    drawingId: declaration.view.drawingId,
    layoutName: sheetOf(scope, declaration.view.drawingId, declaration.view.anchorKey ?? declaration.view.address),
    // Read at the caption's own entity: the words a reader is flown to when the sheet is opened on
    // it (L-CAD-03). A view no caption anchors is read at the only name it has.
    sourceKey: declaration.view.anchorKey ?? declaration.view.address,
    declared: true,
    caption: declaration.view.caption,
  }));
}
