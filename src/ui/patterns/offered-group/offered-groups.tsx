"use client";
/**
 * L-ACT-02's offer, and its one home (B-17, ARCH-02): "bulk is offered, never assembled: the machine
 * offers groups keyed on the fact judged … a freeform multi-select does not exist." Every surface
 * that lets a person act on more than one subject opens this — a second one would be a second answer
 * to who chose the subjects.
 *
 * The substance of the pattern is an absence (I-77): no checkbox, no row selection, no select-all and
 * no per-member list stands anywhere inside it. A visitor cannot add a subject to a group or take one
 * out; the only door is confirming the group exactly as it is named.
 *
 * ARCH-01: the grouping key arrives as a TYPE only — the enum and the act seam are core, and this
 * layer holds no value import of either. The label and the count are the consumer's own words and
 * its own formatting (I-78, I-79); nothing here counts, re-formats or writes prose around them.
 */
import { useId } from "react";
import type { OfferedGroupKey } from "../../../core/acts";
import { Button } from "../../primitives/core";
import { strings } from "../../strings";

/** One group as the consumer offers it: the typed key, the sentence naming it, the live count. */
export interface OfferedGroupItem {
  readonly key: OfferedGroupKey;
  /** R-UI-023's named group, as one sentence the consumer composed — rendered verbatim (I-79). */
  readonly label: string;
  /** The membership count, already through SEAM-FORMAT: the pattern never counts (I-78). */
  readonly count: string;
}

export interface OfferedGroupsProps {
  groups: OfferedGroupItem[];
  onConfirm: (key: OfferedGroupKey) => void;
}

export function OfferedGroups({ groups, onConfirm }: OfferedGroupsProps) {
  const region = useId();
  return (
    // `data-count` reflects the offer's size, so a journey waits on a group's disappearance rather
    // than on a count of nodes. The heading belongs to the consuming screen's hierarchy (I-82).
    <section className="cx-offered" data-testid="offered-groups" data-count={groups.length}>
      {groups.length === 0 ? (
        <p className="cx-offered-empty">{strings.offered_group_empty}</p>
      ) : (
        <ul className="cx-offered-list">
          {groups.map((group, at) => (
            <OfferedGroupRow key={`${group.key.kind}-${at}`} group={group} onConfirm={onConfirm} region={region} at={at} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One row: the sentence, the count that moves, and the one door there is. */
function OfferedGroupRow({ group, onConfirm, region, at }: { group: OfferedGroupItem; onConfirm: (key: OfferedGroupKey) => void; region: string; at: number }) {
  const labelId = `${region}-label-${at}`;
  const buttonId = `${region}-confirm-${at}`;
  const key = group.key;
  return (
    <li
      className="cx-offered-group"
      data-testid="offered-group"
      data-kind={key.kind}
      data-discipline={key.discipline}
      data-drawing={key.kind === "PROPOSED_DISCIPLINE" ? key.drawingId : undefined}
      data-sheet={key.kind === "SHEET" ? key.sheetId : undefined}
    >
      <p className="cx-offered-label" id={labelId}>
        {group.label}
      </p>
      {/* I-80: the count is the only thing that moves while the row stands, so it is the live region
          — a polite region over the whole row would re-announce the sentence with every change. */}
      <span className="cx-offered-count" data-testid="offered-group-count" aria-live="polite">
        {group.count}
      </span>
      {/* I-81: secondary, never the act variant — this door opens the consumer's dialog, and the act
          is carried by that dialog's own confirm (R-UI-001's scarcity). */}
      <Button
        variant="secondary"
        id={buttonId}
        aria-labelledby={`${buttonId} ${labelId}`}
        data-testid="offered-group-confirm"
        onClick={() => onConfirm(key)}
      >
        {strings.offered_group_confirm}
      </Button>
    </li>
  );
}
