# Design Decision — S-Settings (tenant slice: members, invitations, roles)

This is the increment's screen id for the tenant slice of S-Settings, and it names one
screen: `/t/{tenantSlug}/settings`. Its Design Decision is **`docs/design/s-settings.md`, in
full** — the file AC-2 binds acceptance to. This record exists so the screen id resolves to
that contract; it adds no clause and re-decides nothing, because two documents deciding one
screen is how a builder and a grader end up reading different screens. Where this file and
`s-settings.md` could ever be read differently, `s-settings.md` governs.

What the slice covers (R-SPINE-003, J-002): the members list with role management over the
closed set OWNER/ADMIN/MEMBER, the invite-by-email form, the pending-invitations list with
resend and revoke, member removal refused with `MEMBER_HAS_ACTS`, and the R-UI-050 roster
including the MEMBER viewer's permission-denied. Books, templates and every Project-side
pane of S-Settings are later increments and are not designed anywhere yet.

The map, so nothing is looked for in the wrong place:

| Concern | Where it is decided |
|---|---|
| Layout and hierarchy | s-settings.md §1–§4 |
| Every R-UI-050 state, with copy | s-settings.md §4 (empty), §5 (refusal), §6 (roster) |
| Refusal register entries (message, remedy, severity, surface) | s-settings.md §7 |
| Copy, verbatim (screen and mail) | s-settings.md §8–§9 |
| Motion and reduced motion | s-settings.md §10 |
| Tokens | s-settings.md §11 |
| Both themes | s-settings.md §12 |
| Test hooks: route, test ids, journey, axe discipline | s-settings.md §13 |
| Interpretations (admin roles, no ConsequenceDialog, no EvidenceLink at M0, own row, revoke keeps history, mail URL, open-campaign predicate) | s-settings.md preamble |

No route, test id, token, string key or state exists for this screen beyond those
`s-settings.md` states.
