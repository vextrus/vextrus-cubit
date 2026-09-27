# Global from the first line: what M0 must hold so a second market is data, not a rewrite

Researched 27 Sep 2026 for session 02 (design tree item 4). The question: what must be true on day
one (M0) of the Django 6 + Postgres 16 + React 19 SPA so that a second market (the Gulf first: UAE and
Saudi Arabia; then India; later the UK) needs only data and configuration, and what can safely wait?

Inputs read: `docs/intent.md` ("After session 01"), ADRs 0008, 0009, 0016, 0018, 0022, 0033, 0034,
`docs/architecture.md`, `docs/data-model.md` §2–3, `docs/research/stack-deploy.md` §2,
`docs/research/stack-frontend.md` §7 and `docs/design/system.md` §3. The terms are `CONTEXT.md`'s.

**Confidence.**
- **High:** a primary source (a law's text, a standard's own page, vendor docs or source code, the
  AWS status feed) says it and I read it, or I measured it on this machine.
- **Medium:** a law firm's or reputable newspaper's summary, or plain inference from a primary source.
- **Low:** my judgement, or a search-result summary I could not open.

Sources are `[G#]` (web, listed at the end) and `[M#]` (measured here, listed at the end). Nothing
from the real drawings was used.

---

## 0. What is broken, uncertain or unmeasured (read first)

1. **ADR 0034's Gulf plan cannot be carried out today: Bahrain is unavailable, and the UAE is damaged
   with AWS recommending customers leave it.**
   (High, AWS's own status feed [G39].)
   - **UAE, `me-central-1`.** Damaged "as a result of the conflict in the Middle East" from 1 Mar 2026.
     On 30 Apr 2026 AWS "strongly recommend[ed] customers migrate all accessible resources to other
     Regions". On 15 Sep 2026 AWS said it is "unable to restore access to the resources and data hosted
     exclusively in the mec1-az2 Availability Zone", and it gave no date for restoring the Region.
   - **Bahrain, `me-south-1`.** On 15 Sep 2026: "unable to restore access to the resources and data
     hosted exclusively in this Region"; the next update is due in early 2027.
   - **Saudi Arabia.** AWS lists no Saudi region among its 34 [G38]. Amazon says one is "on track to
     launch in December 2026" [G40]. Its region code is not published.
   - The press reports the same, and that AWS advised customers to leave the region [G41].
   - **What follows.** The Gulf cell's location becomes a decision to make when the Gulf opens, from
     whatever is standing then. The lesson also applies to the Mumbai beta: **data held in only one
     region can be lost for good**, so off-region backups belong in the beta, not "at scale".
2. **No Gulf, Indian or UK customer has been asked anything.** How Gulf Developers price, which
   measurement method their QSs use, which digits and languages their documents carry, and whether
   BOQs are bilingual all come from documents here, not from customers. The Gulf answers are the
   weakest (§3.3).
3. **Only the PDF path was tested with Bangla and Arabic** [M2][M3]. The React shell, the BOQ grid,
   the sheet viewer's text and an RTL Excel file have not been built or opened. Nobody who reads
   Arabic or Bangla has judged any output. The "Global in miniature" prototype in the session brief
   is where this gets measured.
4. **The law is read, not advised.**
   - Saudi Arabia's transfer regulation was read only through a law firm's summary: SDAIA's own
     servers refused connections from here [G34].
   - Whether the UAE's PDPL Executive Regulations have been issued is unknown.
   - Bangladesh's Act is quoted from its Bangla text, in my translation [G37].
   - None of this is legal advice. Counsel checks each market before it opens (as ADR 0034 already
     says for Bangladesh).
5. **Gulf measurement practice is thin.**
   - RICS archived POMI on 7 Mar 2023 [G26]. It was still reported in 2011 as "widely used"
     particularly in the Middle East, but that RICS survey report was not reachable, so this is Low.
   - I found no method of measurement mandated by Dubai, Abu Dhabi or Saudi Arabia.
6. **The server and the browser format numbers from different CLDR versions** (Babel 2.18 = CLDR 47;
   Node 24 `Intl` = CLDR 48), and they already disagree for three of our target locales [M1]. The
   shared format table (ADR 0022) catches this only if it has rows for those locales.

---

## 1. Conclusions

### 1.1 The one idea

**A Market is a row of data, and every market difference is read from it or from data it points
to.** Add a `Market` reference table (Library data, one row per market: `BD`, `AE`, `SA`, `IN`, `GB`)
holding:
- the currency, the number format profile and the default UI and document languages;
- the default Display Units and the default Rule Set;
- the benchmark schedule, the tax kinds, the time zone and the work week;
- the home cell (the deployment that serves it).

`Developer.market` and `Project.market` already exist (data-model §3.0–3.1). Today nothing reads them
but a `BD` literal. Everything below is either a column that market data fills, or a rule that stops
code from assuming Bangladesh.

### 1.2 Day-one checklist (what M0 must contain)

The cost figures are my estimates for an agent-built M0, not measurements. The retrofit column says
why a later change is expensive.

| # | What (M0) | Why (evidence) | Cost now | Cost to retrofit |
|---|---|---|---|---|
| 1 | **Every user-visible string is a message in a catalogue.** Use Lingui (ICU MessageFormat in PO files) in the SPA and Django gettext (PO) on the server. English is the only catalogue shipped. No string concatenation and no f-strings in messages; plurals use ICU `plural` or `ngettext`. | Django's docs forbid partial strings and f-strings and require named placeholders, because word order differs between languages [G13]. Arabic has six plural categories and Bangla two (`one` = i = 0 or n = 1) [G7][G15]. Lingui defaults to PO with ICU plurals, so translators use one tool for both sides [G11]. | ≈1 day of setup, then about 5 % per UI ticket. | Every screen and document is touched again, and concatenations have to be found by hand. |
| 2 | **Machine-made sentences are stored as a code plus parameters, never as English prose.** This covers Question text, Check findings, exclusion reasons, upload reports and status words. They are rendered at the edge. | Data-model `Question.text`, `Check.words` and `upload_report` hold prose today. A stored English sentence can never be translated, and old Questions would stay English forever. | Small: a message key and a JSON of parameters per row. | Every historical row is untranslatable, and a data migration has to parse English back into parameters. |
| 3 | **Logical CSS only.** Tailwind `ms-/me-/ps-/pe-/start-/end-` and `text-start`; shadcn/ui initialised with `rtl: true`; one Radix `DirectionProvider`; `<html lang dir>` set from the active language. A lint rule bans `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` in UI code (not in the sheet or 3D canvases). | Logical properties map to the writing direction [G3]. Tailwind's `ms-*` follows `dir` [G4]. Radix primitives "do not automatically inherit direction from the document" [G5]. shadcn's CLI converts classes to logical ones when `rtl: true`, but Calendar, Pagination and Sidebar need manual work, and portals need a `dir` prop [G6]. | Close to zero if done from the first component. | shadcn has a `migrate rtl` command [G6], but hand-written layout, icons and portals are found one by one in an RTL walk. |
| 4 | **Values of a left-to-right kind are direction-isolated by their formatter.** This covers feet-inch dimensions, codes, marks, quantity-with-unit strings and grid refs. On screen use `<bdi dir="ltr">`; in Excel and plain text use LRI…PDI (U+2066…U+2069). | Measured: a plain `14'-6"` inside Arabic text renders as `"6-'14` in visual order. Wrapped in `<bdi dir="ltr">` or LRI…PDI it renders correctly [M3]. UAX #9 explains the cause: a separator between numbers stays attached only in narrow cases (W4–W6), and isolates are "encouraged" [G2]. W3C recommends markup around every opposite-direction phrase [G1]. | Small: the formatters already exist per kind (ADR 0008, `docs/design/system.md` §10). | Every place a value is interpolated. The bug is silent in English, so it is found only in an RTL walk. |
| 5 | **One number and money formatter per value kind, driven by a format profile per market.** The profile holds: grouping style (`lakh` or `thousands`), numbering system (`latn`, `beng`, `arab`), currency, symbol display and minor units. The browser uses `Intl` and the server uses Babel. Both pin the numbering system explicitly (`-u-nu-latn` / `numbering_system="latn"`). Django's `localize` and `USE_THOUSAND_SEPARATOR` are never used for figures. The shared format table gets rows for `bn-BD`, `ar-AE`, `ar-SA`, `en-AE` and `hi-IN`. | Measured: `Intl` gives Bengali digits for `bn-BD` and Arabic-Indic digits for `ar-SA` by default, while Babel gives Latin digits for both. `en-AE` is `AED 123,456,789.50` in `Intl` but `AED123,456,789.50` in Babel [M1]. Django 6.1's own `ar` format file sets the decimal separator to "," and the thousands separator to "." (CLDR `ar` is the reverse), it has no `en_IN` locale and no locale that groups in lakhs by default (lakh grouping is available
  through `NUMBER_GROUPING = (3, 2, 0)`, per the settings docs) [M4]; `localize` is still not used for
  figures, for the `ar` swap and the missing currency and CLDR. Its docs mention neither CLDR nor currency [G14]. | ≈0.5 day beyond what ADR 0022 already requires. | Every formatter call site, plus a silent disagreement between screen, Excel and PDF, which is exactly what ADR 0022's test exists to stop. |
| 6 | **Money carries its currency.** The currency lives on the Project (and on MarketPriceSet, IssuedEstimate and the benchmark edition). The API's money type is `{amount: "…", currency: "BDT"}`. Amount columns have scale ≥ 3. Rounding is "to the currency's ISO 4217 minor unit", not "to the paisa". | ISO 4217 (published 17 Sep 2026): BDT, AED, SAR, INR, QAR and GBP have 2 minor units, but KWD, BHD and OMR have 3 [G21]. `Intl` already applies 3 for KWD [M1]. Data-model §2 types money as "৳ `dec(16,2)`". | Small: one column per money-owning table and one API schema. | Every money column's scale, every rounding site, every Excel formula format and every component that prints "৳" by assumption. |
| 7 | **Market reference data in the Library tenant, not code:** the Market row (§1.1); benchmark schedules generalised from PWD (`schedule`, `edition`, `zone`, `item_code`); `TaxRate.kind` as a code string, not a fixed `vat`/`ait` choice; one default Rule Set per market. | Data-model `BenchmarkRate(sor_edition, zone, pwd_code)`, `BenchmarkMarkup` and `Project.sor_zone` name PWD; `TaxRate.kind` is `vat`/`ait` (AIT is Bangladeshi). India's CPWD schedule and the Gulf, which may have no public schedule at all, fit only if these are generic. | Renaming now, before any data exists. | A migration of Library data plus renames across `rates`, `boq` and `exports`. |
| 8 | **Rule words are Vextrus's own, citing clause numbers only.** | NRM 2: "no part of this work may be reproduced … without the written permission of RICS" [G25]. IS 1200 is © Bureau of Indian Standards [G28]. ADR 0009 already writes rules "in words a QS reads". This makes that the rule for every market. | Zero (a sentence in ADR 0009). | A takedown, or rewriting a Rule Set. |
| 9 | **Time is stored in UTC and shown in the tenant's time zone.** `USE_TZ = True` and `TIME_ZONE = "UTC"`; `Developer.time_zone` defaults from the market (`Asia/Dhaka`); jobs format dates in the tenant's zone. The work week is data, not taken from CLDR. | IANA tz has Dhaka +06, Dubai +04, Riyadh +03 and Kolkata +05:30. Dhaka observed DST once, in 2009, so fixed offsets are wrong for old dates [G48]. CLDR 48 gives Bangladesh a Saturday–Sunday weekend (it is not in the Friday list) [G8][M1], but Bangladesh's weekly holidays are Friday and Saturday [G49]. | Small. | Every stored naive datetime. The "issued at" date on a document shifts across midnight for a Gulf tenant. |
| 10 | **Every id is a UUIDv7 made by the app, and no business key depends on a global sequence.** Object-store keys start with the tenant id. A tenant can be exported and imported whole. | Data-model §2 already says UUIDv7 made by the app. **But Python 3.13 has no `uuid.uuid7()`** (added in 3.14 [G46]), and on our Postgres stack Django 6.1's `UUID7()` database function needs PostgreSQL 18 (it also
  runs on SQLite with Python 3.14 and on MariaDB ≥ 11.7) [M4][G47]. So M0 needs a small library or Python 3.14. RFC 9562 prefers v7 and notes its index locality [G45]. Moving a tenant between cells needs ids that cannot collide and a mapping "accommodating migration" [G44]. | One dependency (or the Python version) and one key-prefix rule. | Rewriting every primary and foreign key before any tenant can move cells. |
| 11 | **Row-level security stays as specified.** One comparison with `current_setting('app.tenant_id')`, and every tenant index leads with `tenant_id`. No joins, sub-selects or function calls in policies. | Measured on PG 16.15 with 2,000,000 rows and 5,000 tenants: the policy becomes an index condition, and per-project and per-tenant queries under RLS cost the same as with RLS bypassed (≈0.35 ms and ≈0.6 ms). The only overhead is setting the tenant once per transaction [M5]. Supabase measured slowdowns of about 20× to 15,000× from unindexed columns, per-row function calls and joins in policies [G43]. | Zero (already ADR 0034); add the index rule to the CI policy test. | — |
| 12 | **One deployment per region (a cell); every tenant has one home cell.** `Developer.home_cell` is set when the tenant is created, and each cell has its own hostname. The global `G` tables (`User`, `ShareLink`) live inside each cell. A cross-cell directory waits. | AWS's cell guidance: choose a partition key at the "grain" of the service and plan how to migrate between cells [G44]. The Middle East outage shows a region can be lost [G39]. | Small: a column and a host-per-cell convention. | Retrofitting a router in front of global tables that assumed a single database. |
| 13 | **Off-region backups from the beta.** Copy automated backups and S3 objects to a second region. | Data held only in AWS UAE's mec1-az2, and in Bahrain, is unrecoverable [G39]. | Small: a few dollars a month (not priced here). | Irrecoverable: this is the one item where "later" can mean never. |
| 14 | **Exports take a language and a direction.** The export job runs under `translation.override(lang)`. The sheet calls `right_to_left()` and RTL cells set their reading order with `set_reading_order()`. The PDF sets `<html lang dir>` and embeds Noto Bengali or Arabic fonts. | Django documents `override()` for background jobs [G13]. XlsxWriter has `worksheet.right_to_left()` and `Format.set_reading_order()` [G16][M4]. WeasyPrint 70 shaped Bangla conjuncts and Arabic joining correctly with embedded Noto fonts, as I inspected it; no Bangla or Arabic reader has checked it [M2]. | ≈0.5 day (a parameter and a template base). | Every document template, with fonts found late on the server. |

### 1.3 What the ADRs cover, miss or contradict

| Where | Says | Verdict | Change I recommend |
|---|---|---|---|
| ADR 0033 | "From day one everything that differs by country is data: Rule Sets, Rate Analyses, currency, Display Units, language." | **Right, but nothing implements it.** | Add the Market row (§1.1) and this checklist as its consequences. |
| ADR 0008 | "Money is always ৳"; "Rounding … rates to the paisa; amount = ROUND(quantity × rate, 2)"; "Display Units … the market's imperial by default"; "Grouping: … lakh and crore". | **Contradicts ADR 0033** on currency. Rounding and grouping are Bangladeshi facts written as universal rules. The imperial default is correctly "the market's". | Money is in the Project's currency. Rounding is to that currency's minor unit (ISO 4217). Grouping comes from the market's format profile (lakh for BD and IN, thousands elsewhere). Keep "coordinates and dimensions never group" for every market. |
| ADR 0022 | "money and quantities group in lakh and crore through `en-IN`, never `en-BD`"; "XlsxWriter … WeasyPrint … with the ৳ glyph embedded"; fonts table for drawings only. | **`en-IN` is hard-coded.** It is the right *grouping locale* for BD but not a design. The UI font Archivo has no Arabic or Bengali (`docs/design/system.md` §3). | Formatting reads the market profile. `en-IN` stays as BD's grouping locale, recorded as data with its reason (CLDR `en-BD` groups in thousands [M1]). The UI font stack gains `unicode-range` fallbacks (Noto Sans Bengali, Noto Sans or Naskh Arabic, OFL [G19]) the day a language ships; the ৳ subset shows the pattern already works. |
| ADR 0016 | "English only: no Bangla screens or documents in the MVP." | **Fine as scope, dangerous as an excuse.** It must not mean strings in code. | Reword: "The MVP ships only the English catalogue; every string is a message from M0" (items 1–2). |
| ADR 0034 | "the Gulf gets its own deployment in AWS's UAE region"; one Postgres; tenant column plus RLS; beta in Mumbai with 14 days of PITR. | **The Gulf region is contradicted by events** [G39]. The cell idea stands. RLS stands (measured [M5]). Backups are single-region. | Gulf region: "chosen when the Gulf opens, from regions then standing; AWS's Saudi region (due Dec 2026 [G40]) and non-AWS Gulf regions to be compared". Add off-region backup copies to the beta. Add `home_cell`. |
| ADR 0018 | Hosted multi-tenant; dedicated deployment later. | **Consistent.** A dedicated deployment is a cell with one tenant. | Say so in one line. |
| ADR 0009 | Default Rule Set is IS 1200 with PWD's conventions; "each labelled with its source". | **Consistent**, and the right shape for markets. | One default Rule Set per market in the Library. Rule words are our own; sources are cited by clause (item 8). |
| data-model §2–3 | "Money in ৳ is `dec(16,2)`"; `Question.text`; `BenchmarkRate.pwd_code`; `Project.sor_zone default Dhaka`; `TaxRate.kind vat/ait`; `User` and `ShareLink` global. | **Bangladesh is baked into names and types.** | Items 2, 6, 7 and 12. |
| CONTEXT.md, "Display Units" | "Money is always ৳; money and quantities group in lakh and crore". | Same as ADR 0008. | Replace with "in the market's currency and grouping". |

### 1.4 What can wait until the second market is chosen

- **Translations** (Bangla, Arabic), and a translator workflow and tool.
- **Arabic and Bengali fonts in the SPA**: a CSS change, because the ৳ subset shows the mechanism.
- **Exchange rates.** Only when a project mixes currencies. The AED and SAR are pegged to the US
  dollar (3.6725 [G22] and 3.75 [G23]), so a USD-quoted import converts at a fixed rate. Day one only
  needs the currency code on each price set, so a mismatch can be detected.
- **Hijri dates.** Saudi Arabia's Cabinet adopted the Gregorian calendar for official procedures in
  2023, except for durations set by Sharia rulings or by an explicit Hijri text (Medium, [G51]).
  `Intl` already renders `islamic-umalqura` for nothing [M1].
- **A Gulf, Indian or UK Rule Set.** Its content waits; its slot (item 7) does not.
- **A cross-cell directory** (one login across cells), a global share-link router, and moving
  tenants between cells.
- **Language-specific search.** PG 16 has an `arabic` text-search configuration but no Bengali one;
  ICU collations `bn-BD-x-icu`, `ar-AE-x-icu` and `ar-SA-x-icu` exist [M6]. Trigram search works
  across scripts.
- **Arabic text in drawings.** DXF R2004 and earlier store text in a code page such as `ANSI_1256`
  (Arabic); R2007 and later use UTF-8 [G52]. This is the Gulf's analogue of the Bangla-ANSI Check, and
  it belongs to the Gulf's reader work.
- **Tax-layer semantics per market** (§5): whether VAT is a cost to the Developer. Only the data slot
  is day one.
- **E-invoicing** (such as ZATCA's) concerns Vextrus's own invoices, not Estimates. It is out of scope.

---

## 2. Languages and scripts

### 2.1 Right-to-left in a React SPA
- **Direction comes from the document plus a provider.**
  - `dir` on `<html>` drives CSS logical properties [G3] and Tailwind's `rtl:`/`ltr:` variants and
    `ms-*`/`me-*` utilities [G4].
  - Radix primitives need an explicit `Direction.Provider`, because they "do not automatically
    inherit direction from the document" [G5].
- **shadcn/ui has supported RTL since January 2026** [G6]:
  - `rtl: true` in `components.json` (or `--rtl` at init) makes the CLI turn `left-*`/`right-*` into
    `start-*`/`end-*`, adapt slide animations and flip icons with `rtl:rotate-180`;
  - it needs a `DirectionProvider`;
  - known gaps: Calendar, Pagination and Sidebar need manual migration, and portals such as
    `PopoverContent` and `TooltipContent` need a `dir` prop because of a `tw-animate-css` issue.
- **What stays left-to-right in an RTL UI.**
  - The sheet and the 3D model are drawings: their coordinates, text and toolbars follow the drawing,
    not the UI (my judgement).
  - The BOQ grid mirrors its column order, but every figure, code and dimension is an LTR run (§2.2).

### 2.2 Bidi of numbers and dimensions (measured)
UAX #9 (Unicode 18.0, revision 52, 1 Sep 2026) [G2]:
- **W4:** "A single European separator between two European numbers changes to a European number."
- **W6:** separators and terminators left over become "Other Neutral".
- **Isolates:** "the use of the directional isolates instead of embeddings is encouraged".

`14'-6"` is: 14, then an apostrophe (neutral), then a hyphen (a separator, but not between two
numbers), then 6, then a double quote (neutral). In an RTL paragraph the neutrals resolve
right-to-left, and the run displays reversed.

WeasyPrint 70 test, reading glyph x-positions from the PDF [M3]:

| Text (in an Arabic `dir="rtl"` paragraph or table cell) | Visual order, left to right | Correct? |
|---|---|---|
| plain `14'-6"` | `"6-'14` | **No** |
| `<bdi dir="ltr">14'-6"</bdi>` | `14'-6"` | Yes |
| `U+2066 14'-6" U+2069` (LRI…PDI) | `14'-6"` | Yes |
| a table cell holding only plain `14'-6"` | `"6-'14` | **No** |
| a table cell holding `<bdi dir="ltr">14'-6"</bdi>` | `14'-6"` | Yes |

W3C gives the same rule: "tightly wrap *every* opposite-direction phrase in markup that sets its base
direction". Use LRI/RLI…PDI only where markup is unavailable [G1]. Browsers implement the same UBA
(not re-measured in Chrome here).

### 2.3 Fonts
- **The UI font has neither script.** Archivo (the UI font, `docs/design/system.md` §3) has neither
  Arabic nor Bengali.
- **Noto fonts under OFL cover them** [G19]:
  - Noto Sans Bengali has ৳ (U+09F3) and Bengali digits.
  - Noto Sans Arabic has Arabic-Indic digits (U+0660…, U+06F0…) but **no Saudi riyal sign U+20C1**.
    Noto Naskh Arabic has U+20C1.
  - **None of the three has the UAE dirham sign U+20C3**, nor the primes ′ ″ (U+2032/2033) [M7].
- **New currency signs.**
  - U+20C1 SAUDI RIYAL SIGN is in Unicode 17.0. U+20C3 UAE DIRHAM SIGN and U+20C4 OMANI RIAL SIGN are
    in Unicode 18.0 [G20].
  - Node 24 implements Unicode 17 [M1], and CLDR 48 still formats SAR as `ر.س.` or `SAR` [M1].
- **So the currency symbol is a market display override, as ৳ already is** (ADR 0022 overrides with
  `narrowSymbol`), with a subset glyph font behind it (the "Vextrus Taka" pattern).

### 2.4 Plurals and messages
- **CLDR plural categories** [G7]:
  - Arabic: zero, one, two, few (n % 100 = 3..10), many (n % 100 = 11..99), other;
  - Bangla: one (i = 0 or n = 1), other;
  - Hindi: the same as Bangla.
- **Measured** with `Intl.PluralRules` [M1]: `ar` gives 0 → zero, 3 → few, 11 → many, 100 → other;
  `bn` gives 0 → one.
- **Gettext** carries Arabic as `nplurals=6` [G15]. Django picks forms from the catalogue's
  `Plural-Forms` [G13].
- **ICU MessageFormat.** FormatJS and Lingui both use `Intl.PluralRules`; `other` is required
  [G12][G11].
- **MessageFormat 2** is a stable part of UTS #35 (LDML 48.2) [G10] and is built into ICU4C and ICU4J.
  ECMA-402 support is described only as "soon" [G10], so M0 uses ICU MessageFormat 1 syntax (what
  Lingui and FormatJS parse).

### 2.5 Server-built documents
- **WeasyPrint** needs Pango ≥ 1.44 [G17].
  - With Pango 1.52.1, HarfBuzz 8.3.0 and embedded Noto fonts, it rendered correctly: Bangla
    conjuncts (ক্ষ, ন্ত্র, স্ত্র), reph (র্ক), the pre-base vowel sign (কি), the split vowel (কো),
    Arabic joining and the lam-alef ligature; RTL table columns ran right to left [M2].
  - **Caveat:** extracting text from that PDF garbled the Bangla (for example ক্ষ… কি came out as
    `< Ǝা`) [M2]. Copying and searching Bangla in our PDFs will be lossy; the printed page is right.
  - Past RTL bugs, both fixed in WeasyPrint 65: Arabic text duplicated in the ToUnicode map (#1686),
    and justified multi-line Arabic with spans collapsing (#2372) [G18].
  - Indic text that renders locally but not on a cloud server has been font packages missing on the
    server (#2080) [G18]. Embed the fonts with `@font-face`; never rely on system fonts.
- **XlsxWriter:**
  - `worksheet.right_to_left()` shows a sheet right to left [G16][M4];
  - `Format.set_reading_order()` sets a cell's reading order [M4].
  - An RTL workbook was **not** opened in Excel here.

### 2.6 Number systems and grouping (measured, Node 24.19: ICU 78.3, CLDR 48.0; Babel 2.18: CLDR 47)

| Locale | `Intl` 123456789.5 | Money | Default digits (CLDR 48 [G9]) |
|---|---|---|---|
| `en-IN` | 12,34,56,789.5 | BDT `narrowSymbol` → ৳12,34,56,789.50 | latn, pattern `#,##,##0.###` |
| `en-BD` | 123,456,789.5 | (Western grouping) | latn |
| `bn-BD` | ১২,৩৪,৫৬,৭৮৯.৫ | ১২,৩৪,৫৬,৭৮৯.৫০৳ (sign after) | **beng**, `#,##,##0.###` |
| `ar-AE` | 123,456,789.5 | `‏123,456,789.50 د.إ.‏` (with RLM marks) | latn (inherits `ar`) |
| `ar-SA` | ١٢٣٬٤٥٦٬٧٨٩٫٥ | `‏١٢٣٬٤٥٦٬٧٨٩٫٥٠ ر.س.‏` | **arab** |
| `en-AE` / `en-SA` | 123,456,789.5 | AED 123,456,789.50 / SAR … | latn |
| `hi-IN` | 12,34,56,789.5 | ₹12,34,56,789.50 | latn |
| `ar-KW` | … | `…٫٥٠٠ د.ك.` (3 decimals) | arab |

Babel differs:
- `bn_BD` BDT → `12,34,56,789.50৳` (Latin digits);
- `ar_SA` gives Latin digits unless `numbering_system="default"`;
- `en_AE` gives `AED123,456,789.50` with no space [M1].

**Which digits Gulf or Bangla business documents actually use is unknown.** It is a per-market
setting to ask customers about. My default is `latn` everywhere (Low).

---

## 3. Money, units and measurement standards

### 3.1 Currency
- **Minor units.** ISO 4217 list one, published 17 Sep 2026: BDT 050, AED 784, SAR 682, INR 356,
  QAR 634 and GBP 826 have 2 minor units; KWD 414, BHD 048 and OMR 512 have 3 [G21]. CLDR's fractions
  data agrees (BHD, KWD, OMR, JOD and TND are 3; IQD is 0) [G8].
- **One currency per project, or per money column?**
  - Per project is enough while prices convert at the edge.
  - Per column is needed only when a project mixes currencies (for example USD-quoted lifts or
    façade). I found no source on Gulf Developers' pricing practice.
  - The pegs make USD conversion trivial: AED 3.6725 = USD 1 (CBUAE: "The policy of the fixed peg …
    will remain in place") [G22]; SAR 3.75, pegged since 1986 [G23].
- **Recommendation.**
  - The currency lives on the Project (the Target Cost is in it) and on each MarketPriceSet, which in
    the MVP must equal the project's.
  - Issued Estimates copy it.
  - The API's money type carries it.
  - FX tables wait.

### 3.2 Units
- **The model is already market-neutral.** ADR 0008's SI Building Model and per-item Billing Units
  work for every target market. `BoqItem.billing_unit_imperial` and `billing_unit_metric` cover two
  unit systems, which is enough: the UK, the Gulf and India bill in metric (NRM 2's own examples are
  in millimetres [G25]).
- **The imperial default is Bangladesh's, not the product's.** It comes from the Market row.

### 3.3 Measurement standards per market

| Market | Method in use | Status of the text | Evidence |
|---|---|---|---|
| Bangladesh | IS 1200 with PWD's item conventions (ADR 0009) | IS 1200 is © BIS (Part 2, "© Copyright 1975") | [G28] High |
| India | IS 1200; CPWD's Delhi Schedule of Rates and Analysis of Rates (DSR/DAR 2023) | © BIS; the CPWD publications were not read (cpwd.gov.in reset the connection) | [G28] High; CPWD Low |
| UK | RICS NRM 1 (cost planning), NRM 2 (detailed measurement, 2nd edition "UK", effective 1 Dec 2021, reissued Oct 2022 as practice information), NRM 3 | "Copyright … rests with RICS … no part … may be reproduced" | [G24][G25] High |
| Gulf (UAE, Saudi) | POMI (RICS 1979), CESMM for civil works, NRM 2 increasingly; ICMS 3 for cost reporting (Qatar is an adopter) | POMI "Archived 7 March 2023" by RICS; ICMS is a cost taxonomy, not a method | [G26][G27] High for status; "which method Gulf QSs use" is Low |

- **A Rule Set per market maps directly onto ADR 0009's model.**
  - The Library holds a default Rule Set per market: its Measurement Rules (in our words, citing
    clause numbers), its Billing Units (metric outside BD), its junction-ownership rule (which
    differs between methods) and its rounding parameters.
  - A Developer copies its market's default.
  - The benchmark (PWD, or CPWD for India) is a separate Library schedule. The Gulf may have none.
- **What must be generic on day one:** the slots, meaning `RuleSet.market`, a generic benchmark
  schedule and the source label. Not the Gulf content.

---

## 4. Taxes (dated data per market)

| Market | Rate and law | Withholding on contractor bills | Evidence |
|---|---|---|---|
| Bangladesh | VAT 10 % on construction firms (S004.00) and AIT 5 %, both deducted at source | Yes (both) | `docs/research/tax-and-allowances.md` |
| UAE | VAT "standard rate of 5%" (Federal Decree-Law 8/2017, Art. 3). The first supply of residential buildings within 3 years of completion is zero-rated (Art. 45(9)); other residential supplies are exempt (Art. 46) | Corporate Tax withholding is "0% (zero percent)" (Federal Decree-Law 47/2022, Art. 45) | [G29][G30] High |
| Saudi Arabia | VAT raised from 5 % to 15 % from 1 July 2020 | Withholding tax applies to payments to **non-residents** (Income Tax Law Art. 68), not to resident contractors | [G31] High; withholding Medium [G32] |

- **Inference (Medium).** A UAE residential Developer's first sales are zero-rated, so it can
  normally recover the VAT on construction bills; VAT is then not a cost in its Estimate. In
  Bangladesh, VAT is a cost (tax-and-allowances.md).
- **So "is this tax a cost?" is a per-market (possibly per-Developer) flag.** The rates are dated
  `TaxRate` rows, whose `kind` is a code the market defines.

---

## 5. Data residency, regulation and regions

| Market | Law (read) | Transfer abroad | In-country hosting needed for Vextrus? |
|---|---|---|---|
| Bangladesh | Personal Data Protection Act 2026, Act No. 63 of 2026, 10 Apr 2026 [G37] | s. 29(3): with the data subject's consent, or where a contract with them covers goods or services. s. 29(4): only to places that regulations name as having suitable storage technology. s. 29(6): bulk transfers of NID, passport, TIN, biometric, genetic or criminal data must be notified | No in-country copy (consistent with stack-deploy.md). **New:** s. 29(5) lets the government set, by gazette, "a fee or charge" on the annual business profit an organisation makes from using Bangladeshi citizens' personal data (my translation). s. 1(3): deemed in force 6 Nov 2025, except ss. 23 and 31–35, which start after 18 months |
| UAE (onshore) | Federal Decree-Law 45/2021 (PDPL), Lexis Middle East English text [G33] | Art. 22: countries with adequate law, as approved by the Data Office. Art. 23: otherwise by a contract obliging the foreign party, or express consent, or to perform a contract with the data subject | No localisation found. Scope (Art. 2) excludes government data and "companies … in the free zones … subject to special legislation" (the UAE portal names the DIFC's Data Protection Law No. 5 of 2020 [G33]). Executive Regulations: status unknown |
| Saudi Arabia | PDPL (Royal Decree M/19 of 2021, amended M/148 of 2023) and the Transfer Regulation (Aug 2024) | Adequacy, Saudi SCCs, BCRs or certification, plus a documented risk assessment | No localisation for private-sector data (K&S, Medium [G34]). **But** NCA's Cloud Cybersecurity Controls reportedly cover government organisations "and its companies" (Low, [G35]). A state-owned Developer (several large ones are) may require in-Kingdom hosting. Ask each first Saudi client |
| India | DPDP Act 2023; DPDP Rules notified 14 Nov 2025, phased over 18 months [G36] | s. 16(1): allowed unless the Centre restricts a country by notification (a negative list). Significant Data Fiduciaries may be directed to store restricted categories locally | No, for Vextrus as an ordinary Data Fiduciary |

**Two consequences for day one.**
1. The client terms and the privacy notice in every market must name every subprocessor and every
   country the data reaches, including TypeSafe's Jev in the US (ADR 0013). That is consent or
   contract under every law above.
2. Personal data stays small (users, and names in title blocks), which keeps each market's transfer
   question simple.

**Regions** [G38][G39][G40]:
- `ap-south-1` (Mumbai) and `ap-south-2` (Hyderabad) are listed.
- `me-central-1` (UAE) and `me-south-1` (Bahrain) are listed but damaged (§0).
- There is no Saudi region yet; AWS says December 2026.
- Other clouds list Gulf regions (Azure UAE North, Microsoft's Saudi East in Q4 2026, Google Doha and
  Dammam, Oracle Jeddah and Riyadh). I did not verify them or check whether the conflict affected
  them (Low).

**One deployment per region (a cell) beats one global deployment** once a market needs its data
nearby. Tenants are placed in a cell at signup by their market and pinned there [G44]. Until then,
Bangladesh and India can share Mumbai.

---

## 6. Tenancy at scale

- **The PostgreSQL rules** [G42]:
  - "Superusers and roles with the `BYPASSRLS` attribute always bypass the row security system".
  - Table owners bypass it unless the table has `FORCE ROW LEVEL SECURITY`.
  - A policy expression "will be evaluated for each row prior to any conditions or functions coming
    from the user's query", except leakproof functions.
- **What makes RLS slow** (Supabase, measured on 100k rows) [G43]:
  - an unindexed filter column: 171 ms → < 0.1 ms once indexed;
  - `auth.uid()` called per row: 179 ms → 9 ms when wrapped in `(select …)`;
  - a `has_role()` function: 178,000 ms → 12 ms;
  - a policy with a join: 9,000 ms → 20 ms once rewritten.
- **Vextrus's policy avoids all of these** [M5]. PG 16.15 on this machine; 2,000,000 rows across
  5,000 tenants (20 projects each); index `(tenant_id, project_id)`; forced RLS; a non-bypass role;
  pgbench with 1 client for 15 s:

  | Case | Mean latency |
  |---|---|
  | One project's sum, RLS bypassed | 0.347 ms |
  | `SET ROLE` + `set_config(tenant)` + `RESET` only | 0.572 ms |
  | The same project query under RLS (including those three statements) | 0.925 ms (query ≈ 0.35 ms) |
  | One tenant's sum (400 rows), RLS bypassed | 0.608 ms |
  | The same under RLS (including the three statements) | 1.189 ms (query ≈ 0.62 ms) |
  | A Library-style policy, `tenant OR library` | BitmapOr on the same index; 3.5 ms for 800 rows |

  - The policy appears in the plan as `Index Cond: (tenant_id = current_setting('app.tenant_id')::uuid)`.
  - RLS itself costs nothing measurable here. The cost is one `set_config` per transaction.
  - **Not measured:** many concurrent clients, tables of 100M rows, or the planner on a tenant with
    far more rows than the average.
- **Identifiers for cells.**
  - UUIDv7 everywhere [G45], generated in the app because PG 16 has no `uuidv7()` (PG 18 does [G47]).
  - Per-project sequence numbers (`seq`, `issue_no`) are fine: they are scoped under a UUID.
  - A per-tenant export and import (stack-data §6) is the tenant move.

---

## 7. Time zones, weekends and calendars

- **Zones** (IANA tz `asia` [G48]):
  - `Asia/Dhaka` +06:00. It observed DST once: 19 Jun–31 Dec 2009.
  - `Asia/Dubai` +04:00; `Asia/Riyadh` +03:00; `Asia/Kolkata` +05:30.
  - `Asia/Muscat` links to Dubai; `Asia/Kuwait` and `Asia/Aden` to Riyadh; `Asia/Bahrain` to Qatar.
  - `Europe/London` changes with DST [M1].
- **Weekends:**
  - Bangladesh: Friday and Saturday for government [G49]. CLDR 48 says Saturday–Sunday [G8].
  - UAE: Saturday–Sunday, with a Friday half-day, for federal and local government from 1 Jan 2022;
    the private sector chooses its own [G50]. CLDR agrees for `ar-AE` [M1].
  - Saudi Arabia: Friday–Saturday, and India: Sunday, per CLDR [G8] (not checked against a national source).
  - **Construction sites' own work weeks are unknown.** The work week is data per market, overridable
    per Developer. It matters for 4D scheduling, not for M0.
- **Hijri:** not needed in documents (§1.4).

---

## 8. For the owner to decide or verify

1. **Adopt the Market row and this checklist into ADRs 0008, 0016, 0022 and 0034** (§1.3).
   Recommendation: yes. Every item is small now, and several are irrecoverable later.
2. **The Gulf region.** Recommendation: strike "AWS's UAE region" from ADR 0034 now. Decide at the
   Gulf's opening among the regions standing then.
3. **Off-region backups in the Mumbai beta.** Recommendation: yes. The cost is small; the price was
   not fetched here.
4. **Money scale 3 and currency on Project.** Recommendation: yes, before the first migration.
5. **Python 3.14 or a UUIDv7 library for M0?** Recommendation: a library pinned to RFC 9562, unless
   the stack moves to 3.14 for other reasons. Either way, a test asserts the version nibble is 7.
6. **Default digits for a future Bangla or Arabic UI.** This is a question for customers, not
   research. Until asked: Latin digits.
7. **Verify with a Gulf QS:** which method of measurement, whether BOQs are bilingual, currency
   practice for imported items, and whether VAT sits in the Estimate.

## 9. What I don't know

- Whether the UAE PDPL Executive Regulations exist, and the exact text of Saudi Arabia's Transfer
  Regulation (SDAIA unreachable).
- The CPWD DSR/DAR 2023 texts and terms, and the RICS 2011 POMI survey.
- An RTL XlsxWriter file in real Excel. Chrome's rendering of the bidi cases (UBA-deterministic, but
  not observed). Our React shell in RTL.
- Gulf developers' pricing and measurement practice, from any customer.
- The state of non-AWS Gulf cloud regions after March 2026.

---

## Sources

- [G1] W3C, "Inline markup and bidirectional text in HTML": https://www.w3.org/International/articles/inline-bidi-markup/
- [G2] Unicode Standard Annex #9, Unicode Bidirectional Algorithm, revision 52 (Unicode 18.0.0, 2026-09-01): https://www.unicode.org/reports/tr9/
- [G3] MDN, CSS logical properties and values: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values
- [G4] Tailwind CSS, margin ("Using logical properties"): https://tailwindcss.com/docs/margin ; RTL variants: https://tailwindcss.com/docs/hover-focus-and-other-states
- [G5] Radix Primitives, Direction Provider: https://www.radix-ui.com/primitives/docs/utilities/direction-provider
- [G6] shadcn/ui, RTL: https://ui.shadcn.com/docs/rtl ; changelog, January 2026: https://ui.shadcn.com/docs/changelog/2026-01-rtl
- [G7] Unicode CLDR, Language Plural Rules chart: https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html
- [G8] CLDR 48 `supplementalData.xml` (weekData, calendarPreference, currencyData fractions): https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/supplemental/supplementalData.xml
- [G9] CLDR 48 locale data `ar.xml`, `ar_SA.xml`, `ar_AE.xml`, `bn.xml`, `en_IN.xml` (defaultNumberingSystem, decimal patterns): https://github.com/unicode-org/cldr/tree/release-48/common/main
- [G10] UTS #35 Part 9, MessageFormat (LDML 48.2, stable): https://www.unicode.org/reports/tr35/tr35-messageFormat.html ; https://messageformat.unicode.org/
- [G11] Lingui: message format https://lingui.dev/guides/message-format ; catalog formats (PO default) https://lingui.dev/ref/catalog-formats ; plurals (CLDR rules) https://lingui.dev/guides/plurals
- [G12] FormatJS, ICU message syntax: https://formatjs.github.io/docs/core-concepts/icu-syntax/
- [G13] Django 6.1, Translation: https://docs.djangoproject.com/en/6.1/topics/i18n/translation/
- [G14] Django 6.1, Format localization: https://docs.djangoproject.com/en/6.1/topics/i18n/formatting/
- [G15] GNU gettext manual, Plural forms: https://www.gnu.org/software/gettext/manual/html_node/Plural-forms.html
- [G16] XlsxWriter, Worksheet (`right_to_left()`): https://xlsxwriter.readthedocs.io/worksheet.html ; Format (`set_reading_order()`): https://xlsxwriter.readthedocs.io/format.html
- [G17] WeasyPrint 70, First steps (Pango ≥ 1.44): https://doc.courtbouillon.org/weasyprint/stable/first_steps.html
- [G18] WeasyPrint issues: #1686 https://github.com/Kozea/WeasyPrint/issues/1686 ; #2372 https://github.com/Kozea/WeasyPrint/issues/2372 ; #2080 https://github.com/Kozea/WeasyPrint/issues/2080
- [G19] Google Fonts repository, OFL fonts: https://github.com/google/fonts/tree/main/ofl/notosansbengali ; https://github.com/google/fonts/tree/main/ofl/notosansarabic ; https://github.com/google/fonts/tree/main/ofl/notonaskharabic
- [G20] Unicode Character Database: https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt (U+20C1) ; https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt (U+20C2–U+20C4)
- [G21] ISO 4217 List One (SIX, maintenance agency), published 2026-09-17: https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml
- [G22] Central Bank of the UAE, "The policy of the fixed peg of the Dirham against the US dollar will remain in place": https://centralbank.ae/en/news-and-publications/news-and-insights/press-release/the-policy-of-the-fixed-peg-of-the-dirham-against-the-us-dollar-will-remain-in-place/
- [G23] Saudi Central Bank (SAMA), exchange rate policy: https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-557.aspx
- [G24] RICS, NRM: https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm
- [G25] RICS, NRM 2: Detailed measurement for building works, 2nd edition UK (effective 1 Dec 2021; reissued Oct 2022), pp. ii–iii: https://www.rics.org/content/dam/ricsglobal/documents/standards/NRM-2_Oct2022_Update.pdf
- [G26] isurv (RICS), "Principles of measurement (international) for works of construction (ARCHIVED)", archived 7 Mar 2023: https://www.isurv.com/downloads/download/164/principles_of_measurement_international_for_works_of_construction_archived
- [G27] RICS, "Global adoption of the ICMS 3rd edition grows" (21 Aug 2023): https://www.rics.org/news-insights/global-adoption-of-the-international-cost-management-standards-icms-3rd-edition-grows
- [G28] BIS, IS 1200 (Part 2): 1974, via Public.Resource.Org: https://law.resource.org/pub/in/bis/S03/is.1200.2.1974.pdf
- [G29] UAE Federal Decree-Law No. 8 of 2017 on VAT and amendments (FTA unofficial translation), Arts. 3, 45(9), 46: https://tax.gov.ae/DataFolder/Files/Legislation/Federal%20Decree-Law%20No.%208%20of%202017%20and%20amendments%20-%20For%20Publishing.pdf
- [G30] UAE Federal Decree-Law No. 47 of 2022 on Corporate Tax (FTA unofficial translation), Art. 45: https://tax.gov.ae/Datafolder/Files/Legislation/Corporate%20Tax/CT%20law%20final/Federal%20Decree-Law%20No.%2047%20of%202022%20-%20For%20publishing.pdf
- [G31] ZATCA, VAT raised to 15 % from 1 July 2020: https://zatca.gov.sa/en/MediaCenter/News/Pages/News-320.aspx
- [G32] ZATCA, compiled withholding-tax circulars (not opened; search summary of Income Tax Law Art. 68): https://zatca.gov.sa/en/RulesRegulations/Taxes/Documents/8.WHT%20CIRCULARS%20AND%20RESOLUTIONS_Withholding%20Eng.pdf
- [G33] UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data, English (Lexis Middle East), Arts. 2, 22, 23: https://privacyarabia.com/wp-content/uploads/2022/08/Decree-Law-45-2021-Data-Protection-Law-English.pdf ; UAE government portal summary: https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws
- [G34] King & Spalding, "International Personal Data Transfers under Saudi Arabia's Data Protection Law" (17 Nov 2025): https://www.kslaw.com/news-and-insights/international-personal-data-transfers-under-saudi-arabias-data-protection-law ; SDAIA primary (connection refused on 27 Sep 2026): https://dgp.sdaia.gov.sa/wps/wcm/connect/e5bbede0-1119-4f70-b4ef-f043ce58d780/Regulation+on+Personal+Data+Transfer+Outside+the+Kingdom..pdf
- [G35] NCA, Cloud Cybersecurity Controls: https://nca.gov.sa/en/regulatory-documents/controls-list/ccc/ (scope as summarised in search results; the PDF was not read)
- [G36] India, Digital Personal Data Protection Act 2023, s. 16: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf ; PIB, "DPDP Rules, 2025 Notified" (17 Nov 2025): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf
- [G37] Bangladesh, ব্যক্তিগত উপাত্ত সুরক্ষা আইন, ২০২৬ (Act No. 63 of 2026), ss. 1(3), 29: http://bdlaws.minlaw.gov.bd/act-print-1692.html
- [G38] AWS, Regions (34 listed): https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html
- [G39] AWS Health Dashboard RSS, "Multiple services (UAE)": https://status.aws.amazon.com/rss/multipleservices-me-central-1.rss ; "(Bahrain)": https://status.aws.amazon.com/rss/multipleservices-me-south-1.rss (entries of 30 Apr and 15 Sep 2026, read 27 Sep 2026)
- [G40] Amazon, "AWS to launch first cloud infrastructure region in the Kingdom of Saudi Arabia by December 2026": https://www.aboutamazon.com/news/aws/aws-cloud-region-saudi-arabia
- [G41] InfoQ, "AWS Cannot Restore Data Held Only in Damaged Middle East Availability Zones" (21 Sep 2026): https://www.infoq.com/news/2026/09/aws-middle-east-data-loss/
- [G42] PostgreSQL 16, Row Security Policies: https://www.postgresql.org/docs/16/ddl-rowsecurity.html
- [G43] Supabase, "RLS Performance and Best Practices" (measured, test repo github.com/GaryAustin1/RLS-Performance): https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- [G44] AWS, "Reducing the Scope of Impact with Cell-Based Architecture", Cell partition: https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/cell-partition.html
- [G45] RFC 9562, Universally Unique IDentifiers (May 2024), §5.7 and §6: https://www.rfc-editor.org/rfc/rfc9562.html
- [G46] Python, `uuid.uuid7()` ("Added in version 3.14"): https://docs.python.org/3/library/uuid.html
- [G47] PostgreSQL 18, UUID functions (`uuidv7()`): https://www.postgresql.org/docs/18/functions-uuid.html
- [G48] IANA tz database, `asia` and `backward`: https://github.com/eggert/tz/blob/main/asia ; https://github.com/eggert/tz/blob/main/backward
- [G49] Prothom Alo, "Govt holidays: 28 days in 2026" (6 Nov 2025): "nine of them fall on weekends (Fridays and Saturdays)": https://en.prothomalo.com/bangladesh/government/uj1g63f9y7
- [G50] The National, "UAE makes major changes to working week" (7 Dec 2021): https://www.thenationalnews.com/uae/government/2021/12/07/breaking-uae-makes-major-changes-to-working-week/
- [G51] Gulf News, "Saudi Arabia adopts Gregorian calendar use in official dealings" (1 Nov 2023): https://gulfnews.com/world/gulf/saudi/saudi-arabia-adopts-gregorian-calendar-use-in-official-dealings-1.99118179
- [G52] ezdxf, DXF file encoding: https://ezdxf.readthedocs.io/en/stable/dxfinternals/fileencoding.html

**Local measurements (27 Sep 2026, scratchpad, not kept).**
- [M1] Node 24.19.0 (ICU 78.3, CLDR 48.0, Unicode 17.0): `Intl.NumberFormat`, `PluralRules`, `DateTimeFormat` (including `-u-ca-islamic-umalqura`) and `Locale#getWeekInfo`/`getTextInfo` for the locales in §2.6 and §7. Babel 2.18.0 (CLDR 47): `format_currency` and `format_decimal`, with and without `numbering_system`.
- [M2] WeasyPrint 70.0 with system Pango 1.52.1 and HarfBuzz 8.3.0, and Noto Sans Bengali, Noto Sans Arabic and Noto Sans via `@font-face`. Rendered with pypdfium2 and inspected visually; text extracted with pypdfium2.
- [M3] The same set-up: five bidi cases, each dimension's visual order read from the glyph x-positions in the PDF's text layer.
- [M4] Django 6.1.1 source: `conf/locale/{ar,bn,hi,en_GB}/formats.py`, `LANGUAGES_BIDI`, `db/models/functions/uuid.py` and `db/backends/postgresql/features.py` (`supports_uuid7_function = is_postgresql_18`). XlsxWriter 3.2.9 source: `Worksheet.right_to_left`, `Format.set_reading_order`. Python 3.13.15: `hasattr(uuid, "uuid7")` is False.
- [M5] PostgreSQL 16.15 (local, port 5544): a scratch database and role, created and then dropped. 2,000,000 rows and 5,000 tenants; `EXPLAIN ANALYZE`; `pgbench -n -T 15 -c 1` for each case in §6.
- [M6] The same server: `pg_ts_config` (includes `arabic`, `hindi`, `nepali`, `tamil`; no Bengali) and `pg_collation` (853 ICU collations, including `bn-BD-x-icu`, `ar-AE-x-icu`, `ar-SA-x-icu`).
- [M7] fontTools cmap checks on Noto Sans Bengali, Noto Sans Arabic and Noto Naskh Arabic (Google Fonts repository, 27 Sep 2026) for U+09F3, U+09E6, U+0660, U+06F0, U+20C1, U+20C3, U+2032 and U+2033.

**Verified by a refuter (27 Sep 2026, session 02).** Claims 1–3 (AWS status feeds, the Saudi region's
December 2026 date), POMI archived 7 Mar 2023, U+20C1 in Unicode 17 and U+20C3 in 18, the UAE's zero
rate for a first residential supply within three years (Decree-Law 8/2017 Art. 45(9)) and the RLS
measurement (reproduced: 0.346 / 0.573 / 0.882 / 0.593 / 1.166 ms) were confirmed. Corrected above: the
UAE region is damaged, not wholly down (some workloads ran; AZs 1 and 3 were being recovered on 15 Sep);
Django can group in lakhs through `NUMBER_GROUPING`; `UUID7()` needs PG 18 on Postgres only. Limits of
the RLS bench: small, cached, uniform tenants, one client, and the tenant set per session rather than
per transaction.
