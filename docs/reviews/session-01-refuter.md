# Session 01 sweep: the refuter

26 Sep 2026. The `refuter` agent tried to refute "the plan is correct, consistent and sufficient",
reading HEAD 8c1227df before the outside plan review. Verdict: refuted. Grilled with the owner.

## Findings, most severe first
1. **Major: the SDLC adopts the tool its evidence rejects.** ADR 0025 and sdlc.md launch waves with the
   Workflow tool; sdlc-claude-code.md:99 and :419 say "Don't use for building"; :177 prices one
   orchestration day at about 3× the old credit. Fix: new evidence, or `claude --cloud` per ticket.
2. **Major: the cloud credit cannot be spent as the plan is shaped.** sdlc.md says $250 (now $500 over
   two accounts); the credit expires about 4–5 Nov 2026 (sdlc-claude-code.md:25-27, secondary source),
   recorded nowhere; M0's finish-line work is `local`, and credit goes only to `cloud` tickets under
   "plan one milestone at a time". At $5–15 a ticket, $500 is 33–100 tickets in about five weeks.
   ADR 0019 "tokens not a constraint" vs CLAUDE.md "medium to stretch the credit". Fix: record the
   date; allow early `cloud` tickets for M1/M2 plumbing, or accept the lapse.
3. **Major: the money data has no source.** No research covers the PWD SoR edition, format, licence
   or encoding effort; nothing sources Rod Ratio defaults (sdlc.md:193 requires a source).
4. **Major: M3's revision finish line cannot pass on an Independent Set:** no real revision pair is in
   hand; only a team-drawn revision could pass it (cause 1). Fix: obtaining a real revised set is an
   explicit M3 dependency.
5. **Major: the `local` PR gate has no expectations:** `.private/work/checks/` does not exist and no
   one is scheduled to write them. Fix: the owner authors per-set expectations per Takeoff Step in M0.
6. **Major: "M3–M5 touch different modules" is false:** M5's RLS is a migration in every module.
7. **Minor: stale effort pin** (sdlc.md says medium; settings.json is high).
8. **Minor: ADR 0007 misreads GTJ's order** (2d-to-bim-approaches.md:96: foundations recognised last).
9. **Minor: Builder spend** "most of the money" (postmortem) vs "about 23 %" (ADR 0025).
10. **Minor: ADR 0014's "as soon as a real vector PDF set is available"** is stale: four PDFs are in
    hand (208 pages, every page with extractable text; images on 7 of 84 Edison architecture pages).
11. **Minor: ADR 0013 lets "files" go to Jev,** but Jev is text only (jev-system-one.md:64, :293).
12. **Minor: ADR 0002 "money in the first milestone":** M0 has none; say M1.
13. **Minor: layering gaps:** Trace → Question points up a layer; confirmed reinforcement has no owner.
14. **Minor: ADR 0024 says managed Code Review works on private repos;** research :88 says Team and
    Enterprise only.
15. **Minor: Ask routing is not uniformly strong** (Banglish what-ifs, jev-system-one.md:128, :160).
16. **Minor gaps:** "what to buy, and when" has no time basis; the Vextrus Engineer's cross-tenant
    access under RLS is undefined; intent.md says OCE has no lakh/crore but its PDF export uses it;
    sdlc.md says two hooks (there are three) and a published chrome-devtools package (there is a
    wrapper).
17. **The new ADR 0005 amendment:** sdlc.md still says "no held-out tests"; milestones.md still names
    Edison as the Independent Set; the citation is :389, not :390.

Checks that held: ৳4/sft pricing; beta cost $87–123; scale cost; Jev costs; 44 ms; 13 modules; OCE
figures.

## On the outside plan review
- **Missed:** 1–6 (in part), 7–16.
- **Overstated:** C5 (the failure was 0.13.3; 0.14 is untested against an independent decoder, not
  shown to fail); C6 (208 / 208 pages carry text on our four PDFs; rasterisation is real but small);
  M8 misquotes ADR 0008 ("declared precision" is not in it); C4 misattributes who writes the
  expectations. M11 confirmed (403 on protection and rulesets).
