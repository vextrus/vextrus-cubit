# OpenConstructionERP / DataDrivenConstruction: business model, pricing, traction

Question: how does OpenConstructionERP (OCE) and DataDrivenConstruction (DDC, Artem Boiko) make
money from an AGPL-3.0 product? Who pays, what for, how much, how big is it? What does that mean
for Vextrus?

Researched 2026-09-25. Sources are the local reference checkouts (`~/reference/...`), live pages
fetched that day, and the GitHub/PyPI APIs. Web pages were downloaded with `curl` and their text
grepped. Where a price appears, it is quoted from the page that states it.

## 1. Who they are

- **One person, legally.** "Licensor operates as a registered small business (Kleingewerbe /
  Einzelunternehmen) under German law" (`~/reference/openconstructionerp/COPYRIGHT`; same wording in
  `~/reference/cad2data-Revit-IFC-DWG-DGN/LICENSE-PROPRIETARY`). "There is a single author": Artem
  Boiko (`~/reference/openconstructionerp/AUTHORS.md`). The CLA and the converter licence both
  expect a *future* UG or GmbH as successor (`COPYRIGHT`; `docs/legal/CLA.md`;
  `LICENSE-PROPRIETARY` §9), so no company has been formed yet.
- Address: Kraichgaustraße 3, 76676 Graben-Neudorf, Germany (near Karlsruhe)
  (https://datadrivenconstruction.io/term-of-use-and-eula/ §18, §21.1). GitHub account
  `datadrivenconstruction` is a *user* account, not an org, created 2021-11-12, 570 followers, 38
  public repos (GitHub API `users/datadrivenconstruction`).
- **Revenue-size signal (my inference).** The EULA says: "The seller is exempt from value-added tax
  (VAT) under the small-business rule of § 19 UStG. No VAT is shown or charged"
  (https://datadrivenconstruction.io/term-of-use-and-eula/ §21.4). From 2025, § 19 UStG applies only
  if net turnover was **≤ €25,000 in the previous year and ≤ €100,000 in the current year**
  (https://www.steuerberaten.de/blog/575/kleinunternehmerregelung-2025-umsatzgrenzen-25000100000-/;
  https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/steuerrecht/umsatzsteuer-national/kleinunternehmerregelung-in-der-umsatzsteuer-1843632).
  If the EULA statement is current and accurate, DDC's invoiced turnover in 2025 was at most about
  €25k. That is an inference from a legal page, not a disclosed figure.

## 2. What they sell, and at what price

The model is **open core plus services plus dual licensing plus paid binaries**, run by one person
and a (planned) partner channel.

| Line | What | Price (as published) | Source |
|---|---|---|---|
| OCE core | AGPL-3.0, all 190+ modules, "There is no paid tier and nothing is held back for one" | €0 | https://openconstructionerp.com/ (pricing and partner sections) |
| OCE commercial licence | Lifts AGPL obligations on OCE's own code (closed SaaS, embedding, procurement waiver); subscription term; Community / Business / Enterprise support tiers in the order form | Not published; "Fees ... are stated in the order form" | `~/reference/openconstructionerp/docs/legal/COMMERCIAL-LICENSE.md` §2, §6, §7; https://openconstructionerp.com/ FAQ |
| "Hosted & licensed" | Managed cloud hosting, on-prem/air-gapped/VPC, SSO, RBAC, SLA, priority support, custom validation rules | "Get in touch" | https://openconstructionerp.com/ (pricing section) |
| cad2data converters (desktop, Windows) | Free "Community" build (personal/research, with ads); paid ad-free "Lifetime License" per converter | **$180** each (Revit, IFC, DWG, DGN); **$240** bundle; **$240** Excel plugin; 30-day refund | https://cadbimconverter.com/product/ad-free-dwg-to-excel-converter/ ; https://cadbimconverter.com/product/revit-converter-to-xlsx/ |
| Converter commercial licence | Required for "Commercial use in a revenue-generating capacity, use in a software-as-a-service offering, or redistribution" | Not published | `~/reference/cad2data-Revit-IFC-DWG-DGN/LICENSE-PROPRIETARY` §2.2; README "Licensing" |
| DDC software EULA tiers | Community (free), Professional (per workstation, one company, email support), Enterprise (negotiated: unlimited users, SaaS rights, SLA, indemnity) | Not published | https://datadrivenconstruction.io/term-of-use-and-eula/ §3.1–3.3 |
| CWICR cost database | Data CC BY-NC 4.0 (non-commercial only); commercial use needs a DDC commercial licence; code Apache-2.0 | Not published | GitHub `OpenConstructionEstimate-DDC-CWICR` README "License" |
| AI agent setup | "AI Agent Deployment" session; "Complete AI Agent Setup: Claude Code + OpenClaw" | **€300/hr** (1–2 h typical); **€700 fixed** | https://datadrivenconstruction.io/contact-support/ |
| Workflow development (n8n/Dify, RAG) | Simple / Popular / Complex | **$500–1,500**; **$2,000–5,000**; **$7,000–15,000**; €500/month support; €300/hr training; +50 % rush; €300–900 server setup | https://datadrivenconstruction.io/contact-support/ |
| OCE custom build | Discovery to deployment on client hardware, source delivered, AGPL or commercial | "From 4 weeks", 4–12 weeks; price not published | https://openconstructionerp.com/ (build/train/advise section) |
| Workshops | 1–3 days, on-site or remote, up to 12 participants; modular data workshops, 2-day automation programme | Not published | https://openconstructionerp.com/ ; https://datadrivenconstruction.io/contact-support/ |
| Consulting | By the day or retainer | Not published | https://openconstructionerp.com/ |
| Book | *Data-Driven Construction*; free digital read, paid print, 30+ languages | Print **$167.42** (EN), ~$169 other editions | https://datadrivenconstruction.io/books/ ; https://datadrivenconstruction.io/product/data-driven-construction/ |

Note: a WebFetch summary of the contact page reported €400/hr; the raw page text downloaded the same
day says €300/hr. The raw text is used here.

### The partner channel ("Open core. Paid on top.")

OCE's newest lever is a reseller/implementer channel, launched as a "Founding cohort"
(https://openconstructionerp.com/partners):

- €0 partnership fee, "forever, written into the agreement"; no quotas or certification fees.
- Partners keep **100 %** of their services (implementation, training, support, custom modules)
  and **80 %** of DDC products they resell (OCE commercial licence, CWICR database, localisation
  packs, cad2data converters). The homepage version says partners keep "25–65 %" on commercial
  licences (https://openconstructionerp.com/), which contradicts the partner page's 80 %.
- Written promise: "DDC will never compete with partners on implementation services."
- Worked example for a "small/mid construction firm, ~15 seats": €20,000 deal = €0 core + €3.5k
  localisation pack + €3.5k commercial SKUs (licence, CWICR, connectors) + €10k implementation +
  €3k year-2 SLA; partner take €18,000. So **DDC's own share of a typical deal is about €2k**
  (20 % of the two €3.5k product lines plus 20 % of the €3k SLA). The page's "ERP integrator"
  profile projects €320–520k year-1 partner take from 18–28 deals.
- These are illustrative projections. No partner is named on the page.

In short: the AGPL product is the marketing. The money is meant to come from consulting and
workshops by the founder, a small stream of $180 converter licences and $167 books, and in future
a 20 % cut of partner-sold licences, data and SLAs.

## 3. Customers and traction

**Named organisations** (testimonials and "public workshops", not proof of a paid OCE deployment):
- DDC homepage testimonials: AECOM, RB Rail AS, OBERMEYER Group, Consolidated Contractors Company,
  Build Informed GmbH, TU München, RZD and others (https://datadrivenconstruction.io/, via WebFetch
  summary).
- OCE homepage "Public workshops": ETH Zürich, Drees & Sommer, Lindner Group, Bauindustrie Bayern &
  TUM, BIM Cluster BW, BIM DAY Genf, Herbert Gruppe, several "Under NDA". "Many major enterprise
  engagements remain under NDA" (https://openconstructionerp.com/).
- DDC claims users in "87+ countries" (https://datadrivenconstruction.io/).
- The cad2data README shows a "DataDrivenConstruction clients and users" logo image
  (`~/reference/cad2data-Revit-IFC-DWG-DGN/README.md` lines 49–52); the image was not inspected.
- OCE's `/cases` pages are role and company-type scenarios; no named customer company appears
  (https://openconstructionerp.com/cases, WebFetch). **No named paying OCE customer was found.**

**GitHub** (GitHub API, 2026-09-25):

| Repo | Stars | Forks | Created | Licence |
|---|---|---|---|---|
| OpenConstructionERP | 844 | 264 | 2026-04-02 | AGPL-3.0 |
| cad2data-Revit-IFC-DWG-DGN | 500 | 106 | 2025-06-19 | MIT + proprietary |
| DDC_Skills_for_AI_Agents_in_Construction | 333 | 82 | 2026-01-24 | MIT |
| OpenConstructionEstimate-DDC-CWICR | 240 | 61 | 2025-12-09 | CC BY-NC 4.0 + Apache-2.0 |

- **Contributors:** the API lists 79, but `datadrivenconstruction` has 6,153 commits and no other
  contributor more than 9 (a bot) or 3. The project "does not accept external pull requests";
  outside patches are read, credited and re-implemented (`CONTRIBUTING.md`; `CONTRIBUTORS.md`). The
  README says the history understates contributors because work is "published through a single
  maintainer account" (`README.md`, "Development and Contribution Model"). 212 issues ever filed; 2
  open.
- **Release cadence:** 289 GitHub releases between v0.1.0 (2026-03-30) and v18.0.0 (2026-09-24),
  about 1.6 a day, 18 major versions in six months (GitHub releases API; `CHANGELOG.md` has 392
  version headings). The homepage FAQ says "Minor releases roughly every 2-3 weeks"
  (https://openconstructionerp.com/). The record contradicts that. The pace fits a heavily
  AI-assisted single maintainer; I am inferring that, it is not stated.
- **Downloads:** GitHub release assets 9,043 in total; PyPI `openconstructionerp` 44,966 since
  2026-04-04 without mirrors, 4,761 in the last month (pypistats.org API). Downloads include CI and
  bots and are not users.
- No figures for users, installs, revenue, paying customers or partners are published anywhere
  checked.

## 4. The competitive price landscape

| Product | Pricing (published) | Source |
|---|---|---|
| Bluebeam | $260 / $330 / $440 / $590 per user per year (Basics/Core/Complete/Max) | https://www.bluebeam.com/pricing/ |
| PlanSwift | $2,000 / $3,000 per seat per year (Essential/Core) | https://www.planswift.com/pricing/ |
| RIB CostX | No public price; Complete/Core/Quantify packages, standalone or network licence, "GET MY CUSTOM PRICING" | https://www.rib-software.com/en/rib-costx/pricing |
| Procore | Annual fee by product based on Annual Construction Volume; unlimited users; no public figures | https://www.procore.com/pricing |
| OCE's own framing | Competitors "€10–15k / €6–12k / €3–8k" per seat per year plus €15–150k implementation (unsourced marketing) | https://openconstructionerp.com/ ; `README.md` comparison table (~€30–500/mo) |
| Bangladesh: OMS SaaS (TechSoftBD) | Free trial, "Subscription in BDT", no figures; claims Procore is "$10,000–$60,000+/year" and that $19/user/month for 20 staff is "over ৳40,000/month" (vendor marketing) | https://www.techsoftbd.com/best-construction-management-software-in-bangladesh/ |
| India: CloudBoQ | SaaS estimator; yearly activation fee plus per-project plans; no figures | https://cloudboq.qsondemand.com/ |

The incumbents that publish prices charge per seat per year, in USD, from about $260 (PDF markup)
to $3,000 (takeoff). Estimating suites and Procore hide their prices behind sales.

## 5. Implications for Vextrus

**What OCE's model shows.**
1. AGPL plus "free forever" has bought reach (844 stars in six months, 45k PyPI downloads) but no
   visible revenue. The only published prices are for founder services and $180 binaries, and the
   § 19 UStG statement points to small turnover. The open-core ERP is not yet a business. It is a
   funnel for consulting and a hoped-for partner channel.
2. Its free tier is self-hosted and needs someone to install it. For a Bangladeshi SME without IT
   staff, "free" still means a partner or a consultant, which is exactly what the partner programme
   tries to sell.
3. Its data moat (CWICR) is CC BY-NC. Commercial users need a licence anyway.

**A different model for Vextrus (options for the owner to decide; not researched further here).**
- Hosted SaaS priced in BDT for the local market (a per-project or per-firm subscription rather than
  per-seat USD), where the paid value is a *finished outcome* (a checked BOQ or estimate from the
  drawings, BNBC/PWD-rate aware) rather than software access. Nobody in the local sources publishes
  a price, which leaves room for a transparent one.
- A "done-for-you" layer (AI plus QS review) sold per drawing set or per estimate, which OCE's
  self-host model cannot offer without a partner.
- Local data as the moat: PWD/LGED schedules of rates and BNBC rules as first-party data.
  CWICR has no Bangladesh base (OCE's nine national bases are China, Turkey, Brazil, Spain, Italy,
  Greece, Vietnam, Indonesia plus the CIS-derived global base: `README.md` line 139).
- Keep Vextrus's own code proprietary or permissively licensed. Nothing from OCE may come in anyway
  (CLAUDE.md law), so AGPL obligations should not attach to us.

**What their licences mean for us as a competitor.**
- **OCE (AGPL-3.0):** we may study it, which is what our law already allows. Copying any code,
  schema or data would force AGPL onto the combined work, and running it as a network service
  triggers §13 source disclosure. The commercial licence would not fully solve this, because
  PyMuPDF is separately AGPL (`COMMERCIAL-LICENSE.md` §4a). The commercial licence also bars
  selling OCE "as a standalone product" or under a name implying DDC origin (§2), and bars use of
  the "OpenConstructionERP", "OpenEstimate", "DataDrivenConstruction" and "CWICR" marks (§3, §5).
- **cad2data binaries (proprietary):** the clauses that matter are in `LICENSE-PROPRIETARY` §3 and
  EULA §3.4:
  - (e) "use the Binary Software to develop a competing product" is prohibited;
  - (a) no reverse engineering; (b) no derivative works; (f) no redistribution in any product or
    service without written consent;
  - §2.2: revenue-generating commercial use or SaaS needs a separate commercial licence;
  - §4.1: ODA pass-through terms (no reverse engineering or extraction of ODA-derived parts; export
    control; no use in embargoed countries). Bangladesh is not on the listed embargoed destinations
    (`EXPORT-COMPLIANCE.md` §2).

  Vextrus is plausibly a "competing product" (converter plus estimating), so **we must not run the
  converters even for internal development or evaluation that feeds Vextrus**. Our CLAUDE.md already
  says the binaries are not run, and this clause is the legal reason. The MIT parts (n8n workflows,
  Python scripts, docs) carry no competing-product restriction. Only their ideas matter to us,
  since we do not copy their code.
  There is a licence inconsistency: EULA §3.1 allows Community use for "individual commercial
  purposes", while `LICENSE-PROPRIETARY` §2.1–2.2 limits it to "internal evaluation and lawful
  personal or professional use" and requires a licence for revenue-generating use. Neither version
  permits building a competitor.
- **Trademarks:** "DDC", "cad2data", "RvtExporter" etc. may not appear in our product or domain
  names (`TRADEMARK.md` §3). Factual comparison only.
- **CWICR data:** CC BY-NC 4.0, so it cannot be used commercially in Vextrus without a DDC licence.
  Our law excludes their data anyway.
- **DWG reading for Vextrus** needs our own route: ODA membership (as DDC did, per
  `LICENSE-PROPRIETARY` §4.1), a permissive library, or DXF/PDF inputs. This is an architecture
  decision for later.

## Unknown

- Actual DDC/OCE revenue, and whether the § 19 UStG statement is current. It rules out large
  turnover only if it is accurate.
- Any price for the OCE commercial licence, hosted plan, converter commercial or Enterprise licence,
  CWICR commercial licence, workshops or consulting days.
- Whether any organisation pays for OCE today; the number of partners in the "Founding cohort".
- Headcount beyond Artem Boiko. LinkedIn was not checked.
- Book sales volume and converter licence sales volume.
- Whether the logo wall and testimonials were paid engagements, and for which product.
- CostX and Procore actual prices: vendor-quoted only. Third-party estimates exist (Capterra,
  ITQlick) but were not used.
- Local Bangladeshi estimating/BOQ software prices: none published in the sources found. The one
  local vendor page (OMS SaaS) is marketing without figures.
