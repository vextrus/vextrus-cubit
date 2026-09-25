# Vextrus is hosted by us for all clients; a dedicated deployment is offered later

Vextrus runs as one hosted system that we operate. Each Developer's data is strictly separated
inside it. Later, a large client that insists can have a dedicated deployment (one client, in its own
cloud account), priced accordingly. We do not ship software for clients to install and run themselves.

Why:
- A small team can operate one system, and every client gets fixes the same day.
- Per-project pricing (ADR 0012) assumes we deliver the result.
- The GPL DWG reader (LibreDWG) runs only on our own servers, which keeps its licence clean. A
  distributed install would not.

Because tenant separation is designed in from day one, a dedicated deployment is a configuration
choice, not a rewrite.

Considered: self-hosted installs at each client, as OpenConstructionERP offers. Rejected: each client
becomes a separate upgrade and support burden, and it would put the GPL reader in software we
distribute.

## Correction (26 Sep 2026)
A dedicated deployment in a client's cloud would convey LibreDWG, which obliges us only to ship
LibreDWG's source and licence with it; our own code stays ours because LibreDWG runs as a separate
program and is never linked in (docs/research/dwg-reader-options.md). The reader is ADR 0029.
