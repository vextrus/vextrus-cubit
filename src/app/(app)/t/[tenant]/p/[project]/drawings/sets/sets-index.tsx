"use client";
// S-Drawings-Sets (R-TO-005): the sets index — the door that names a set, and one row per set the
// project holds with the digest it stands pinned at.
//
// `createSet` replaces the server action and nothing else: given it, the screen maps the settlement
// exactly as it maps the real one, which is what makes the screen a browser renders and the section
// a test renders one component (the SheetIndex precedent).
import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { refusalOf, type RefusalCode } from "../../../../../../../../core/errors";
import { formatUserFigure } from "../../../../../../../../core/format";
import { RefusalState } from "../../../../../../../../ui/patterns/refusal-state";
import { Button, Input } from "../../../../../../../../ui/primitives/core";
import { ShellEmptyState } from "../../../../../../../../ui/shell";
import { fill, strings } from "../../../../../../../../ui/strings";
import type { DrawingSetSummary } from "../../../../../../../../modules/takeoff/sets";
import { participantsRoute } from "../../settings/participants/route-address";
import { drawingsRoute } from "../route-address";
import { createSet as createSetAction } from "./actions";
import { setRoute, setsRoute } from "./route-address";
import { sets } from "./strings";

export interface SetsIndexProps {
  tenantId: string;
  projectId: string;
  sets: readonly DrawingSetSummary[];
  /** Whether this reader holds PIN_SET on the project (I-101). */
  canPin: boolean;
  createSet?: typeof createSetAction;
}

/** Where a refusal this screen can meet is resolved: a place, named in the button voice. */
interface Evidence {
  readonly href: string;
  readonly label: string;
}

export function SetsIndex({ tenantId, projectId, sets: held, canPin, createSet = createSetAction }: SetsIndexProps) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const headingIds = { create: useId(), list: useId() };
  const nameId = useId();

  const evidenceFor = useCallback(
    (code: RefusalCode): Evidence => {
      if (code === "PERMISSION_NOT_HELD" || code === "WORKSPACE_PERMISSION_NOT_HELD") return { href: participantsRoute(tenantId, projectId), label: sets.sets_evidence_participants };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return { href: setsRoute(tenantId, projectId), label: sets.sets_evidence_reload };
    },
    [tenantId, projectId],
  );

  const submit = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setRefusal(null);
    const answered = await createSet({ tenantId, projectId, name });
    setPending(false);
    if (!answered.created) {
      setRefusal(answered.refusal);
      return;
    }
    // The new set standing open is the answer — no toast, and nothing here says it twice. The set
    // is server-read at its own address, so the way to it is the address itself.
    open(setRoute(tenantId, projectId, answered.setId));
  };

  return (
    <div className="cx-sets">
      <header className="cx-sets-header">
        <h1 className="cx-sets-heading">{sets.sets_heading}</h1>
        <p className="cx-sets-caption">{sets.sets_caption}</p>
        <Link className="cx-sets-link cx-reticle" data-testid="set-drawings-link" href={drawingsRoute(tenantId, projectId)}>
          {sets.sets_drawings_link}
        </Link>
      </header>

      {/* I-101: the whole index stands for a reader without PIN_SET — knowledge is not permission —
          and one banner names the permission and who holds it. A door that can only refuse is not
          rendered at all. */}
      {canPin ? null : (
        <div className="cx-sets-denied">
          <p className="cx-sets-denied-line">{sets.sets_denied_permission}</p>
          <p className="cx-sets-denied-line">{sets.sets_denied_holder}</p>
          <RefusalState refusal={refusalOf("PERMISSION_NOT_HELD")} evidence={evidenceFor("PERMISSION_NOT_HELD")} />
        </div>
      )}

      {canPin ? (
        <section className="cx-sets-section" aria-labelledby={headingIds.create}>
          <h2 className="cx-sets-section-heading" id={headingIds.create}>
            {sets.sets_create_heading}
          </h2>
          <p className="cx-sets-hint">{sets.sets_create_hint}</p>
          <form
            className="cx-sets-form"
            data-testid="set-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <span className="cx-sets-field">
              <label className="cx-sets-field-label" htmlFor={nameId}>
                {sets.sets_name_label}
              </label>
              <Input className="cx-sets-name" data-testid="set-name-input" id={nameId} ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} />
            </span>
            <Button data-testid="set-create" loading={pending} type="submit">
              {sets.sets_create_submit}
            </Button>
          </form>
          <p className="cx-sets-status" role="status" aria-live="polite">
            {pending ? sets.sets_create_pending : ""}
          </p>
          <div className="cx-sets-answer">
            {refusal === null || pending ? null : <RefusalState refusal={refusalOf(refusal)} evidence={evidenceFor(refusal)} />}
          </div>
        </section>
      ) : null}

      <section className="cx-sets-section" aria-labelledby={headingIds.list}>
        <h2 className="cx-sets-section-heading" id={headingIds.list}>
          {sets.sets_list_heading}
        </h2>
        <p className="cx-sets-hint">{sets.sets_list_hint}</p>

        {held.length === 0 ? (
          <div data-testid="sets-empty">
            <ShellEmptyState heading={sets.sets_empty_heading} body={sets.sets_empty_body}>
              {canPin ? (
                <Button variant="ghost" onClick={() => nameRef.current?.focus()}>
                  {sets.sets_empty_action}
                </Button>
              ) : (
                <Link className="cx-sets-link cx-reticle" href={drawingsRoute(tenantId, projectId)}>
                  {sets.sets_drawings_link}
                </Link>
              )}
            </ShellEmptyState>
          </div>
        ) : (
          <ul className="cx-sets-list" data-testid="sets-index">
            {held.map((set) => (
              <SetRow key={set.setId} projectId={projectId} set={set} tenantId={tenantId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Stand the browser at an address of this product's own — the one navigation this screen makes. */
function open(href: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(href);
}

/**
 * One set of the project: what it is called, how much it holds, and the address it stands pinned at.
 *
 * I-99: the digest renders character for character, so its label sits outside the element the
 * contract names and the text equals `data-digest` exactly. A set that has never been pinned
 * publishes no digest and says so in prose — never a dash, and never a fake hex value.
 */
function SetRow({ set, tenantId, projectId }: { set: DrawingSetSummary; tenantId: string; projectId: string }) {
  return (
    <li className="cx-sets-row" data-testid="set-row" data-set={set.setId} data-name={set.name}>
      <div className="cx-sets-row-facts">
        <p className="cx-sets-row-name" data-testid="set-row-name">
          {set.name}
        </p>
        <p className="cx-sets-row-counts">
          <span>{fill(sets.sets_row_members, { count: formatUserFigure(String(set.memberCount)) })}</span>
          <span>{fill(sets.sets_row_revisions, { count: formatUserFigure(String(set.revisionCount)) })}</span>
        </p>
        <p className="cx-sets-row-digest-line">
          <span className="cx-sets-row-digest-label">{sets.sets_row_digest_label}</span>
          {set.currentDigest === null ? (
            <span className="cx-sets-row-unpinned" data-testid="set-row-digest" data-digest="">
              {sets.sets_row_digest_none}
            </span>
          ) : (
            <span className="cx-sets-digest" data-testid="set-row-digest" data-digest={set.currentDigest}>
              {set.currentDigest}
            </span>
          )}
        </p>
      </div>
      <Link className="cx-sets-link cx-sets-open cx-reticle" data-testid="set-open" href={setRoute(tenantId, projectId, set.setId)}>
        {sets.sets_open}
      </Link>
    </li>
  );
}
