# OpenConstructionERP: a walk of the running product, as a Bangladeshi QS would do it

Question: walking the running OpenConstructionERP (OCE) at http://127.0.0.1:8080 as a Bangladeshi
quantity surveyor/estimator, where do its flows and UI/UX work, and where do they fall short?

Method: OCE v18.0.0, demo mode, signed in with "Try demo" as the Admin demo user on 2026-09-25.
Headless Chromium through the chrome-devtools MCP at a 1440x900 viewport, with one check at 390x844.
Everything below comes from what the product showed on screen, from the DOM text, from network
requests, or from OCE's own server log (`~/reference/.data/oce/serve.log`). Screenshots are in
`/tmp/claude-1000/-home-riz-vextrus-cubit/oce-walk/` (NN-*.png; they are outside the repo and will
not survive a reboot). OCE strings appear only as short quotes where a finding needs them.

What I changed in OCE's demo data: I created one project, "Vextrus Walk - Dhaka G+6 RCC
Residential" (BDT, custom region "Bangladesh"). It has one bid schedule, "Civil works - estimate
R0", holding one position. I also opened one CAD-BIM match session on the demo IFC. Nothing else was
edited.

**Law incident (read first).** In BIM 3D Takeoff I chose a small IFC file
(`Ifc2x3_Duplex_Architecture.ifc` from cad2data's `Sample_Projects/`). Choosing the file was enough
for the page to send `POST /api/v1/takeoff/converters/ifc/install/` on its own. I never pressed
"Upload & Process". The server then downloaded about 241 MB of DDC packages, unpacked them to
`~/.openestimator/converters/_ddc_linux_amd64/`, and ran the proprietary `IfcExporter` once as a
self-test. The server log records this at 14:04:47 ("self-test OK", "ready at …/IfcExporter"). The
file itself was never processed. Nothing asked for consent and nothing offered a way to cancel. The
binaries are still on disk. Removing them is the owner's call (`rm -r` asks the owner). From here
on, any upload to BIM or DWG in OCE will run the converter.

## 1. Summary

- **Breadth is real, and so is the clutter.** The sidebar shows "31 / 162 modules" in Simple mode,
  and the header carries 12 controls. Every module page opens with a dismissible explainer banner
  about 150 px tall, plus "Cases", "Tour" and "How it works". The dashboard is 5,755 px tall and
  makes 64 API calls. On the bid schedule editor at 1440x900, the first BOQ row starts about 630 px
  down the page, so only about 8 rows fit on screen.
- **The core estimating grid is decent.** It has a section/position hierarchy, an M/L/E resource
  breakdown per position, a regional markup stack (the India pack gives CP&OH 15%, contingency 3%,
  BOCW cess 1%, GST 18%), revisions, lock, a what-if copy and a tender hand-off. It creates an
  empty BDT bid schedule in about 6 clicks from "New Project".
- **The numbers do not agree with each other**, and for a QS product that is the worst kind of
  defect. On one Indian demo project I found four different "budget" figures and a grand total that
  adds the budget BOQ and the detailed BOQ together (§3, S1). On one bid schedule I found three
  different quality scores. BIM dimensions are reported in mm but labelled as metres.
- **In this install the AI is mostly not there.** No provider is configured, semantic search is not
  installed, and CAD-BIM Match needs embeddings. Each AI entry point fails only after the user has
  typed a prompt or reached step 2. Where the design around AI is good, it is good on paper: "AI can
  only re-order real candidates, never invent a code", an auto-confirm threshold of 0.88, and an
  "AI added" filter on the BOQ.
- **Nothing is made for Bangladesh.** There is no Bangladesh region, pack, cost base or
  classification, and no Bengali UI. BDT exists as a currency, but its glyph "৳" rendered as tofu
  in the currency picker. There is no EUR→BDT FX rate, so the rate checks skip BDT bills. The
  screen never uses lakh/crore grouping, not even for INR, although the PDF export does. The cost
  database search is literal and US-imperial ("brick" returns chimney bricks for thermal power
  plants first).

## 2. Module map as seen in the product

**Sidebar, Simple mode.** It shows 31 of 162 entries, in these groups:
- Overview: Dashboard, Projects, Cases, Documents, Inbox, Timeline
- Takeoff: PDF Measurements, DWG Takeoff, BIM 3D Takeoff, Quantity Takeoff
- Cost Data: Cost Database, Resource Catalog, Cost Explorer, Assemblies, Cost Match, Currencies
- Estimating: Bid Schedule, Bid Schedule Templates, Import / Export, CAD-BIM Match → Cost (BETA),
  Estimation Dashboard, Conceptual Estimate, Methodologies
- Drawings & Files: Drawing Sheets
- Reality Capture & 3D: Geo Hub (BETA), Point Cloud (BETA)
- Commercial: Contracts, Payment Clock, Withholding Tax, Tax Rates, E-invoice Clearance

The dashboard also says "193 Modules". Schedule, finance, validation and reports live outside the
visible sidebar and are reached from the project hub, the header or a direct URL.

**Project hub** (`/projects/:id`) has these tabs: Dashboard, Overview, 4D Schedule, 5D Budget,
Tendering, Photos, Compliance. Its widgets are RFI inbox, Change orders pulse, Variations, Daily
diary, HSE, Photo strip, NCRs, Compliance, Schedule summary, Budget burn, Recent files, AI insights,
Recent activity, KPI tiles and Quick actions.

**Schedule** (`/schedule`) has 15 tabs: Table, Gantt, EVM, 4D, Quality, Risk, Compare, Progress,
Delay, Codes, Calendars, Resources, Live, Interchange. It also offers "Generate from Bid Schedule".

**Header.** It carries a project selector, a regional-pack badge, "Project journey (Step N)",
Search ⌘K, notifications (99+), What's new, Build a module, Support us, Subscribe, Report a bug,
Help, Language, Theme and Account, plus a floating "Ask AI about your data" button.

**Regional packs.** There are 39 packs across US/CA/MX/BR, the EU, UK, CN, IN, JP, KR, ID, SG, AU,
NZ, NG, ZA, RU, TR, UAE and Saudi Arabia. There is no Bangladesh pack. The India pack references
CPWD Specs 2019, CPWD DSR 2023, IS 456 and IS 1893.

**Cost bases on the import page.** The CWICR family offers "55,719 items per region" across 48
databases. There are 9 base families: Dinge, GESN/FER, Birim Fiyat, SINAPI, BCCA, Prezzario
Toscana, GGDE, AHSP and one more, each "priced into" many countries. None of them is for
Bangladesh.

## 3. Per-flow findings, ranked by severity

Severity: **S1** = it produces a wrong number or breaks trust; **S2** = it blocks or badly slows a
real task; **S3** = friction or polish.

### S1: wrong numbers and broken trust

1. **The project totals double count and disagree.** Screen: `/projects/e0a6ceec…` (Government
   Office Complex, New Delhi), 5D Budget tab, screenshot 25. On one page the product showed:
   - "GRAND TOTAL ₹815,975,622.78". This equals the "Budget" BOQ (₹339,395,900) plus the detailed
     BOQ (₹476,579,722.78), so two versions of the same estimate are added together.
   - Budget burn "of INR 346,183,818".
   - 5D "TOTAL BUDGET ₹339,395,900.00".
   - The dashboard and project cards show "678.8M INR" for the same project, which is exactly
     2 × 339.4M.

   The tiles also use a "$" icon on INR amounts. A QS cannot tell which number is the estimate.
2. **BIM element dimensions are in mm but labelled m.** Screen: `/bim/…` (Residential House IFC
   model), wall selected, screenshots 09–10. The panel read "Width (m) 8,955 · Depth (m) 290 ·
   Height (m) 2,821.093 · Footprint (m²) 2,596,950 · Bounding volume (m³) 7,326,237,466.35" for a
   wall that is 8.955 × 0.29 × 2.82 m. Any quantity taken from this panel is off by 10⁹ in volume.
   The same wall also showed "No additional properties", although the page promises "full
   properties, quantities and classifications".
3. **There are three quality scores for one bill, and all of them say "Great".** Screens:
   `/boq/3a55d0e9…`, then `/validation?boq_id=…`, screenshots 33–34. I entered RCC 1:1.5:3 in
   footings at BDT 1,250,000/m³, about 100 times the real rate. The editor showed "QUALITY 90 Great"
   and, beside it, "Validate 25%". The validation page then showed "89 %". The rate check did not
   run: "no EUR to BDT rate is on file" (to its credit it said so, but it still graded the bill
   "Great"). On the Delhi BOQ the editor showed "Quality 100 Great" next to "Validate 99%".
4. **The Delhi BOQ's cost-breakdown donut adds up to 128.8%.** Screen: `/boq/cac9b13a…` → Markups
   / Cost Breakdown, screenshot 13. Material 50.2%, Labor 41.8% and Equipment 8.0% are shares of
   direct cost. Overheads 10.7%, Contingency 2.1%, Cess 0.7% and GST 15.3% are shares of the grand
   total. Both sets sit under one "TOTAL 476,579,722.78", which also overflows its ring.
5. **The validation noise makes it look like a gate it is not.** Screen: `/validation?boq_id=cac9b13a…`,
   screenshot 22. It checked 1,504 rules and raised 34 warnings, almost all of them "Unit Rate
   Anomaly Detection", which compares each rate with the median of the whole bill regardless of unit
   or trade. For example: "Position 2.4: rate 10,850.00 is >10,250.00 (5x median)" for RCC M30 beams
   at ₹10,850/m³, which is a normal rate. Findings are labelled by UUID fragments ("313844d0"), not
   by position numbers. Rule sets applied: "cpwd, MasterFormat, Bid Schedule quality". MasterFormat
   applied to a CPWD bill. None of the checks is an engineering check. Excavation position 1.2
   carries a "Disposal/Fill material" resource and nothing flags it.
6. **It installs and runs a proprietary binary without asking.** See the law incident above
   (screenshot 07, network request `POST …/converters/ifc/install/`). A product that says "100%
   Local Processing" should not fetch 241 MB and run a vendor executable because a file was chosen.

### S2: blocks or badly slows a real task

7. **The project context goes stale.** The header project selector did not follow the bid schedule
   that was open:
   - With the Delhi BOQ open, it showed "Reside…" (screenshot 11), and later "Vextru…"
     (screenshot 21).
   - With my BDT project's BOQ open, it showed "Govern…" (screenshot 31).
   - The header badge reads "US Construction Pack" on every page, including the BDT/Bangladesh
     project.

   The project hub for a brand-new project showed "Could not load projects" in its KPI strip.
8. **The rate "analysis" is a proportion split, not a rate analysis.** Screen: Delhi BOQ, position
   1.2 expanded, screenshot 12. The BOQ is titled "CPWD DSR 2021", yet the position carries three
   generic resources with CWICR codes ("CWICR-ERT-001-…"): Disposal/Fill material 1.00 m³ ₹42.75,
   Machine operators 1.19 hr ₹71.25, Excavator/trucks 1.80 hr ₹171. These exactly reproduce a
   "60% EQU · 25% LAB · 15% MAT" label. No DSR item number appears anywhere: not in the grid, not in
   the PDF. A BD QS expects the PWD SoR item code and a real analysis (for example: bricks nos,
   cement bags, sand cft, mason/labour days).
9. **The cost database cannot find Bangladeshi work items.** Screen: `/costs`, screenshots 18–19.
   Only the US base is loaded (55,719 items, USD, "100 SF", "CY", "82.0 ft"). Search results:
   - "brick flat soling", "brick soling", "cement concrete 1:3:6" and "reinforced concrete footing"
     all returned 0 items.
   - "concrete" returned 4,889 items, the first being "Installation of metal wells…".
   - "brick" returned 541 items, the first three being thermal-power chimney items.

   Codes look like "KADX_KADX_KAKAME_KAME". "AI search" answered "not installed on this deployment".
   Import offers no Bangladesh base (screenshot 20).
10. **AI fails late and in developer language.** Screen: BOQ → "AI Chat", screenshots 16–17. The
    empty panel says "For example:" and then shows no examples. After I typed a real prompt it
    replied: "No AI API key configured … set an environment variable such as ANTHROPIC_API_KEY /
    OPENAI_API_KEY (or add it to ~/.openestimator/config.json)". The floating chat button overlaps
    the input's send button. In CAD-BIM Match, step 2 says "Semantic matching is not part of this
    installation … pip install openconstructionerp[semantic-clients]" (screenshot 28). The same
    step says "No catalogs loaded yet", although the US base is loaded. The display-currency list
    has 19 currencies and BDT is not one of them.
11. **CAD-BIM Match fails at step 4 → 5 with a server error.** Screen: `/match-elements`, IFC model,
    default grouping "By IFC class + Type", screenshot 29. The next step raised
    `IntegrityError … uq_match_group_session_key` in the server log (duplicate group key for
    `IfcWall|Basic Wall: Wall-Ext_102Bwk…`). The UI stayed on step 4 and showed no message. The
    grouping preview itself shows the classification problems:
    - curtain-wall mullions become "Structural member · structural";
    - 14 furniture items are counted as estimable groups;
    - external walls are in m³ and partitions in m;
    - the same wall is "architectural" here but "structural" in the viewer's property panel.
12. **4D is empty and the schedule has no logic.** Screen: `/schedule`, Delhi programme, screenshots
    23–24. It has 13 activities, one per BOQ section. "Concrete Work & RCC" starts on 1 Apr 2026,
    the same day as Earthwork, even though a dependency arrow joins them. Waterproofing & Roofing
    comes after the facade. The header says "Apr 01, 2026 – Mar 21, 2028", but the last activity
    ends in Sep 2027. The 4D tab says "No linked elements", so the demo has no 4D to show.
13. **Keyboard entry breaks in the grid.** Screen: `/boq/3a55d0e9…`. In a new row I typed the
    description, pressed Tab, typed the unit and pressed Tab again. Focus then left the grid: the
    quantity and rate I typed were lost, and the page jumped to the Markups panel (screenshot 32).
    The row stayed at 0.00. Double-clicking the cells worked. The activity feed shows an internal
    event name ("boq.cost_breakdown.computed").
14. **The mobile layout did not work.** At a 390x844 mobile emulation, the BOQ page laid out 1122 px
    wide and showed only a toolbar fragment (screenshot 30). I did not investigate further.

### S3: friction and polish

15. **The page title and the pack badge overlap in the header on every page** ("Da…" / "Proje…"
    under "US Construction", screenshots 01, 02, 05, 07).
16. **Figures use Western grouping on screen, even for INR.** The screen shows "₹476,579,722.78",
    while the PDF export shows "47,65,79,722.78" (Indian grouping). Screen and paper disagree.
    Nothing is shown in lakh or crore.
17. **The PDF export is sparse.** Detailed BOQ PDF: 13 pages for 97 positions, about 9 per page. The
    Pos. column is wide and the Description column narrow, so descriptions wrap to 5–6 lines. The
    summary block breaks words ("Contingen / cies"). It carries "Prepared by: Elena Marchetti" (the
    demo persona), even though the signed-in user is Admin. The Reports page picked the "Budget"
    BOQ by default.
18. **The Reports copy does not match the files.** "Schedule Report: Gantt chart with project
    timeline, milestones, and critical path" downloads as TXT. "Validation Report: Compliance check
    … against DIN 276, NRM, or MasterFormat" downloads as CSV.
19. **The BIM viewer is cramped.** Its canvas was 1191x400 px of a 1440x900 window: the explainer
    banner, a converters warning, a "scan vs design" popover and an asset-info card all stack over
    it (screenshot 08). The asset card hides the "Match" tab content (screenshot 10). The filmstrip
    card's accessible name is "Delete model Residential House - …", which is risky for screen
    readers and automation.
20. **The DWG demo is a toy.** It has 8 entities. The toolbar's "Cases 1" chip overlaps tool icons,
    and the drawing text is clipped by the tool panel (screenshot 27). Real DWG needs "Install
    converter", which is the proprietary one.
21. **Project creation offers the wrong choices for Bangladesh.** The region list has 31 entries,
    no Bangladesh and no South Asia apart from India. The classification list has 15 standards and
    none for South Asia. The language list has 24 languages and no Bengali. "Custom…" for region
    forces a free-text field before Create unlocks (screenshots 03–04).
22. **The "Project journey" step changes from page to page.** It read Step 2, 3, 4, 5 and 8 on
    different pages with no visible rule. The notifications badge reads "99+" from demo noise.

### What works

- **Project creation is quick.** Quick create needs only a name. I went from "New Project" to an
  empty BDT bid schedule in about 6 clicks and under 30 s.
- **The grid is a real estimating grid.** Hierarchy, M/L/E split per position, quick filters
  (Errors / No price / Zero qty / AI added), paste from Excel, variables, renumbering, version
  history, lock, revisions, what-if and "To tender".
- **The markup stack is right for a regional QS.** The India template gave an ordered CP&OH →
  contingency → cess → GST build-up with a clear Direct → Net → Gross summary (screenshot 13).
- **Validation is honest about what it skipped.** It reports "not assessed: no EUR to BDT rate",
  not a fake pass. It also exports findings to XLSX/CSV and links them to positions.
- **The AI boundaries are well designed on paper.** "AI can only re-order real candidates, never
  invent a code", an explicit auto-confirm threshold (0.88) with the rest waiting for review, an
  "AI added" filter in the BOQ, and a choice of net vs gross (openings deducted) quantities.
- **The BIM viewer is usable.** Filters by story, category and type; buckets; a summary panel;
  isolate/hide/ghost; section box; measure; walk; "Link N to Bid Schedule"; and compare versions.
  The model loaded in a few seconds.
- **Speed is fine locally.** A cold navigation to the Delhi BOQ showed its grand total in about
  2.4 s. The dashboard settled in about 3.2 s. No console errors appeared on any page I walked
  (only WebGL driver warnings).
- **The FX module's design is sound.** Rates are recorded as dated, lockable sets, and "a pair the
  rates cannot price returns no figure at all". It was empty in this install ("0 currencies, 0
  sets").

## 4. UX principles we should beat it on

1. **One number, one source.** A project has one current estimate total. Budget versions and
   alternative BOQs never sum into it. Every total names the bill and revision it comes from.
2. **Units are part of the value.** Quantities carry their unit from source to screen. A
   dimension panel that can show a 7-billion-m³ wall must be impossible, not merely unlikely.
3. **One quality verdict, and it means something.** Show one score, computed one way, and never
   "Great" while rate checks are skipped. Checks compare like with like (unit, trade, SoR item) and
   are engineering checks (a resource that does not belong, a missing item, a rate outside the SoR
   band). Findings name position numbers, never IDs.
4. **Bangladesh first, not a pack among 39.** PWD SoR (with the item code on every line and a real
   rate analysis), BNBC 2020, BDT with "৳" rendered, lakh/crore on screen and on paper identically,
   and Bengali labels where a site engineer needs them.
5. **The work surface first, explanation on demand.** The grid or the model is the page. No
   150 px banners, stacked popovers or 12-button headers. The first BOQ row sits near the top of
   the screen.
6. **AI shows up ready, or says clearly that it is not.** If a capability is off, its entry point
   says so before the user types, in QS language, without environment variables. When it is on,
   every AI-added value is marked, reviewable and reversible, as OCE designs it but does not
   deliver in this install.
7. **Nothing runs or downloads without consent.** No hidden installs, and no vendor binaries.
8. **The context follows the work.** Opening a bill sets the project, the pack and the currency
   everywhere on screen.
9. **Keyboard-complete entry.** Tab and Enter walk description → unit → quantity → rate → next row,
   as in a spreadsheet.

## 5. What we should match

- The quick-create project flow and the empty-state guidance on a new bill.
- The estimating grid's feature set: hierarchy, M/L/E breakdown, filters, paste from Excel,
  revisions, lock, what-if and tender hand-off.
- The ordered, regional markup template with a Direct → Net → Gross summary. For Bangladesh that
  means our own template (for example VAT/AIT and contractor's profit and overhead), which the
  owner should confirm.
- A validation that reports what it could not assess and exports its findings.
- Dated, lockable FX rate sets, with no figure where no rate exists.
- An AI match flow that works as shortlist → rerank → threshold auto-confirm → human review →
  apply, where the AI can only choose among real catalogue rows.
- A BIM viewer that filters by story, category and type, has a live summary, and links a
  selection to the BOQ, with net and gross quantity options.
- Local-first responsiveness: pages usable within about 2–3 s.

## Not walked or not testable here

- AI outputs (chat, cost advisor, AI estimate, rerank). No provider is configured, and adding a key
  is the owner's decision.
- Semantic cost search and CAD-BIM match steps 5–7 (not installed, and a server error at step 4).
- Uploading my own IFC/DWG. I stopped deliberately after the converter auto-install; processing
  would run the proprietary converter.
- PDF takeoff with a real drawing, tendering, change orders, the finance module in depth, dark
  theme and accessibility audits.
