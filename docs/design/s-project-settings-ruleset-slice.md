# Design Decision — S-Project-Settings (ruleset slice)

This is the increment's screen id for the ruleset slice of S-Project-Settings, and it names
one screen: `/t/{tenantSlug}/p/{projectId}/settings/ruleset`. Its Design Decision is
**`docs/design/s-project-settings.md`, in full** — the file acceptance binds to. This record
exists so the screen id resolves to that contract; it adds no clause and re-decides nothing,
because two documents deciding one screen is how a builder and a grader end up reading
different screens (the s-settings tenant-slice precedent). Where this file and
`s-project-settings.md` could ever be read differently, `s-project-settings.md` governs.

What the slice covers (R-SPINE-012, L-REG-07, J-003 "rule-set pin visible"): the read-only,
server-rendered pane showing the edition key `IS1200_IN @ 2026.08`, the project edition's
full 64-hex digest, the platform → workspace → project lineage with each edition's digest,
and the seventeen L-MEA-01 parameters with values and units. Project create/edit fields,
participants and roles, method files, authoring and every other pane of project settings are
later increments and are not designed anywhere yet.

The map, so nothing is looked for in the wrong place:

| Concern | Where it is decided |
|---|---|
| Layout and hierarchy | s-project-settings.md §1–§2 |
| Pin card: edition, digest, methods line | s-project-settings.md §3 |
| Lineage list and its order | s-project-settings.md §4 |
| The seventeen parameter rows (labels, ids, values, units, order) | s-project-settings.md §5 |
| Every R-UI-050 state, with reasons for the unmintable ones | s-project-settings.md §6 |
| Copy, verbatim | s-project-settings.md §7 (+ §5's label table) |
| Motion (none) and reduced motion | s-project-settings.md §8 |
| Tokens | s-project-settings.md §9 |
| Both themes | s-project-settings.md §10 |
| Test hooks: route, test ids, journey, axe discipline | s-project-settings.md §11 |
| Interpretations (no acts, units as strings not UnitBadge, `ratio` for dimensionless, the one grouping rule, flat seventeen rows, tenant-only breadcrumb, 404 for outsiders, full lineage digests) | s-project-settings.md preamble |

No route, test id, token, string key or state exists for this screen beyond those
`s-project-settings.md` states.
