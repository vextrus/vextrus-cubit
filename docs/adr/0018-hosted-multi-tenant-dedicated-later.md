# Vextrus is hosted by us for all clients; a dedicated deployment is offered later

Vextrus runs as one hosted system that we operate, with each Developer's data strictly separated
inside it (row-level security, ADR 0034). Later, a large client that insists can have a dedicated
deployment (one client, in its own cloud account), priced accordingly. We do not ship software for
clients to install and run themselves.

Why:
- A small team can operate one system, and every client gets fixes the same day.
- Per-project pricing (ADR 0033) assumes we deliver the result.
- Tenant separation designed in from day one makes a dedicated deployment a configuration choice, not
  a rewrite.

**Licences.** On our own servers the GPL DWG reader, LibreDWG, is not distributed. A dedicated
deployment in a client's cloud would convey it, which obliges us only to ship LibreDWG's source and
licence with it; our own code stays ours because LibreDWG runs as a separate program and is never
linked in (docs/research/dwg-reader-options.md; the reader is ADR 0029).

Rejected: self-hosted installs at each client, as OpenConstructionERP offers: each client becomes a
separate upgrade and support burden.

## History
- 25 Sep 2026: decided.
- 26 Sep 2026: correction: a dedicated deployment conveys LibreDWG but does not bind our code.
  Evidence: docs/research/dwg-reader-options.md.
- 28 Sep 2026 (session 02, ADR 0038): a dedicated deployment is a cell with one tenant; every Developer
  has a home region, so a second region is a new cell, not a different product.
