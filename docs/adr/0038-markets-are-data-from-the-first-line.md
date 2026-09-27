# Markets are data from the first line: what M0 builds so a second market is configuration

Bangladesh is the first **Market**, and "going global is a matter of time" (the owner, docs/intent.md),
so M0 builds eight market-neutral habits, each cheap now and a rewrite later:
1. **A Market is a row of data** that every Developer and Project points to (Bangladesh the only one),
   with its own Library: Rule Set, Resources, Rate Analyses, Rebar Ratios, benchmark source (PWD's SoR
   for Bangladesh), tax kinds, Construction Stage names, allowances, and its format profile, unit
   systems, languages, time zone and work week.
2. **Every visible string is a message in a catalogue** (English the only one shipped); sentences the
   machine writes (Questions, Check findings, upload reports, exclusion reasons) are stored as a code and
   parameters, never as English prose.
3. **One formatter per kind of figure, driven by the Market** (grouping, digits, currency and its symbol
   position, short-form scales; Bangladesh borrows `en-IN` for lakh and crore). Dimensions, marks, grid
   labels and other drawing notation are always isolated left to right. One table of expected strings is
   checked in the browser (from M0) and on the server (from M1).
4. **Direction-neutral CSS only** (logical properties, with a lint); the sheet and 3D canvases are fixed
   left to right, never mirrored.
5. **Money carries its currency**, rounds to that currency's minor units (2 for ৳; 3 for KWD, BHD,
   OMR), and money columns hold 3 decimals.
6. **Billing Units are rows per unit system,** and each Market offers its own unit systems (Bangladesh:
   imperial by default, metric; the Gulf: metric only).
7. **Times are stored in UTC** and shown in the Market's time zone; the work week is data.
8. **UUIDv7 ids everywhere, file keys prefixed by the tenant, and a home region per Developer,** so a
   tenant can live in, or move to, another region's deployment (a cell).

**What waits** for the second market: translations and their fonts, right-to-left testing, the digit
switch, that Market's Rule Set, rates and price book, calendars, a cross-region directory, and the PDF
engine for non-Latin scripts (decided before the first non-English document: WeasyPrint breaks Bangla).
A Market that measures something new still needs engine code; only its parameters are data.

Why: the session-02 global prototype rendered Bangladesh in English and Bangla, the Gulf in Arabic and
English, and a 3-decimal-currency market from one codebase whose source holds no market literal, and it
needed exactly these habits; the research priced them at about a day of setup and about 5 % per UI ticket
(docs/research/global-markets-foundation.md). Measured on the way: dimensions inside Arabic text read
backwards unless isolated (14′-6″ → ″6-′14); Chrome has no `en-BD` formats; WeasyPrint breaks Bangla
conjuncts while headless Chrome prints them correctly. Rejected: markets as a later rewrite (every screen,
figure and money column touched again, stored English untranslatable).

Amends ADRs 0008 (money in the Market's currency, rounded to its minor units; grouping and unit systems
per Market), 0016 (English-only is the MVP's scope, not its code), 0022 (`en-IN` is Bangladesh's data; the
PDF engine for non-Latin scripts is open), 0033 (a price book per Market when a second one opens) and
0034 (a home region per Developer).

## History
- 27 Sep 2026 (owner's decision, session 02 Q15). The owner's ruling: "Agree with your recommendation on
  Q15".
