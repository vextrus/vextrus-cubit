# Vextrus — intent

The first of the playbook's documents (intent → spec → plan). It says what we are building and why,
in the owner's terms. Decisions live in `docs/adr/`, terms in `CONTEXT.md`.

## The product
An AI-native platform for the AEC business, starting with Bangladeshi real-estate Developers. One
project dataset, the Building Model, is built first from the Developer's 2D AutoCAD drawings through
a Takeoff the QS drives and the machine assists. Every department and later module works from that
dataset. Our market does not use BIM (Revit is rare in practice), so turning 2D drawings into a
working Building Model is both the core of the MVP and the moat. No one does it well:
OpenConstructionERP never attempts it (docs/research/oce-algorithms.md).

## The first customer and the MVP
- **Who:** the Developer. The MD buys and the QS uses the product daily. The founding team's network
  already reaches Developers waiting to see it (ADR 0033).
- **What they pay for:** the Priced BOQ, the Material Schedule and the Building Model in 3D, from one
  QS-confirmed Takeoff (ADR 0002), priced per project by Gross Floor Area (ADR 0033).
- **Scope:** RCC-framed buildings, read from structural and architectural drawings; MEP as lump sums
  from a template (ADR 0003).
- **How the Takeoff works:** building-first, fourteen Takeoff Steps, bulk Confirmation, and Questions
  at the point of need; Checks against the source raise those Questions (ADRs 0007, 0027).
- **Money, from M1:**
  - A whole-building figure from the first Confirmation: every Trade carries a Cost Basis, measured
    or a marked allowance, and the Target Cost warns on measured + allowance (ADR 0002).
  - Rate Analyses priced at the Developer's Market Prices, with PWD as the Benchmark, shown net of
    PWD's mark-ups (ADR 0006).
  - The Estimate is layered: direct cost, preliminaries and site overheads, contingency and taxes,
    each shown and editable (ADR 0006).
  - An Issued Estimate is frozen; every later change is shown against it, split into quantity and
    price effect (ADR 0028).
  - Measurement Rules held as data, defaulting to IS 1200 with PWD's conventions (ADR 0009).
  - Rod by ratio first, then read from the drawing, with its Rod Basis on every figure (ADR 0010).
  - Each BOQ Item in its Billing Unit, rounded as a QS rounds; the market's imperial units on screen;
    money and quantities in lakh and crore (ADR 0008).
- **For the MD:** the Project Summary and the 3D share link work on a phone; the QS's work is
  desktop-only (ADR 0016).
- **Honest inputs:** DWG first; a vector PDF is accepted, and the product tells the QS at upload how
  much it could not read and what to ask for instead (ADR 0014).
- **Proof:** the Sample Project and the Edison set are Development Sets that prove nothing
  regressed; Held-out Sets from other consultants, which no build session opens, prove Vextrus
  reads Dhaka drawings, scored blind against a Hand Takeoff (ADRs 0004, 0005, 0026).
- **AI:** Levels 1 and 2 on Jev (ADR 0011).

## How we beat OpenConstructionERP
It is broad (194 modules) and free, but shallow where our clients live
(docs/research/oce-*.md):
- **2D → Building Model.** OCE never attempts it; its DWG path yields a spreadsheet of CAD records.
  This is our core.
- **Numbers you can trust.** OCE double-counts totals, mislabels mm as m, and passes a ৳ rate 100×
  too high. We trace every figure, check it in code, and a QS confirms it.
- **One real dataset.** OCE's "one dataset" is a hub of loose ids with 31 event subscriptions nothing
  publishes. Ours is one typed chain: element → quantity → BOQ item → rate, tested end to end.
- **Local depth.** OCE has no Bangladesh region, no PWD rates, no lakh/crore on its screens (only its PDF export groups in lakh), and a blank box for ৳.
  We have a Rule Set on IS 1200 with PWD's conventions, PWD Benchmark Rates, Dhaka Rate Analyses,
  imperial units, lakh grouping and ৳.
- **Measurement standards.** OCE applies none; we apply a Rule Set the QS can read and edit.
- **UX.** OCE ranks lowest here. We design for the QS's real workflow: building-first Takeoff, bulk
  Confirmation, Questions at the point of need.
- **Quiet AI.** Jev inside the flow, cheap and bounded, instead of a bring-your-own-key chatbot.
- **A business, not a free download.** We sell a finished result per project (ADR 0033).

## Next after the MVP
- Cost control during construction.
- Level 3 AI: the first autonomous job, likely a revision comparison.
- Then the modules beta Developers ask for.

## The owner's broader ideas (their words, condensed; to be placed in the sequence)
- **Quiet intelligence, not an AI gimmick.** Most software now calls itself "AI-integrated" and means
  a chatbot on an API call. Vextrus must not shout "AI". It should silently do and deliver things, so
  clients are astonished by using it. Jev turns ordinary yes/no and CRUD nodes into smarter ones where
  that helps. Code remains the first preference where it is obvious (after TypeSafe's manifesto,
  https://typesafe.ai/manifesto).
- **Project memory.** Each tenant's historical data is kept securely and searched semantically, fast
  and accurately (a vector store or similar). Clients drop in raw old documents, the system files
  them systematically, and they start serving at once. Over time this history pays off.
- **A live project that wakes when needed.** Once a real project's dataset exists, events on it are
  watched in real time. The system stays quiet most of the time, then wakes to flag an anomaly or
  suggest an action, and notifies the client for a faster response.
- **4D Schedule and 5D Cost** on the real dataset, built with the project's real engineers.
- **Continuous development driven by client feedback** is itself part of what changes the industry.
- Glodon's "Evolving into BIM 2.0" (owner's copy in ~/reference/) describes much of this vision
  already running in Glodon's products. Its study is in docs/research/glodon-bim-2.md.
