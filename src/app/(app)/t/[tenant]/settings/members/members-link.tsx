// I-60: the members surface's own door on the settings landing. Every shipped screen is reachable by
// visible navigation from the shell — a screen reached only by a typed URL is a failing criterion
// (R-UI-031) — and the section that says so belongs to the members glob, so the landing gains one
// import and nothing else.
//
// It travels through the router like every other move inside the frame, so browser back returns to
// the landing it was pressed on.
import "./members.css";

import Link from "next/link";
import { membersRoute } from "./route-address";
import { membersStrings } from "./strings";

export function SettingsMembersLink({ tenantId }: { tenantId: string }) {
  return (
    <section className="cx-members-link">
      <span className="cx-shell-field-label">{membersStrings.members_link_label}</span>
      <p className="cx-shell-field-hint">{membersStrings.members_link_hint}</p>
      <Link className="cx-members-link-action cx-reticle" data-testid="settings-members-link" href={membersRoute(tenantId)}>
        {membersStrings.members_link_action}
      </Link>
    </section>
  );
}
