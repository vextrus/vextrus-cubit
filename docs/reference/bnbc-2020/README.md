# BNBC 2020 — the column transverse-reinforcement clauses, vendored

**Why this is here.** AM-12 §1–2 and B-24: a clause no session can check against its source is a clause no
session can build to, and "no session invents a rate, a norm or a code value from memory". F-RCC6-BNBC's
S-01 general note 2 cites the code — `DESIGN CODE: BNBC 2020, ACI 318-19 WHERE THE CODE IS SILENT` — and
states the column tie SPACINGS (S-11 `10Ø@100/150 (TIES)`) but no zone length. The owner ruled on
2026-09-23 (session 7) that column ties are derived from the code the drawing cites, and that the text be
fetched from an official public copy. These are the only pages the derivation reads.

## The instrument

Bangladesh Gazette, Extraordinary, Thursday 11 February 2021, pp. 2583–5042; Ministry of Housing and
Public Works; Notification **S.R.O. No.55-Law/2020** — *The Bangladesh National Building Code (BNBC) 2020*,
made under section 18A of the Building Construction Act, 1952. A public government publication (AS-02's
footing for government documents).

## Sources, as retrieved 2026-09-23 (2026-09-22T21:04Z), over HTTPS with a verified certificate chain

| copy | URL | bytes | sha256 |
|---|---|---|---|
| **primary** — Bangladesh Government Press (the gazette itself) | https://www.dpp.gov.bd/upload_file/gazettes/39201_96302.pdf (listing: https://www.dpp.gov.bd/bgpress/index.php/document/get_extraordinary/39201); HTTP Last-Modified 12 Jun 2023, PDF modified 2021-03-09; 2,461 pages | 59,673,170 | `b4a1efbcaa6654951ac7801829dfd23db2a45257fdfea9887b88515c1a0a6dd0` |
| corroboration — HBRI (linked from hbri.gov.bd's BNBC page as "BNBC 2020 (Part-1)/(Part-2)"; gazette pp. 2583–3803 only, p. 3396 missing) | https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/axvjbnqprylg/b/V2Ministry/o/office-hbri/2024/12/dadd5d6e06f0453a9639b3b81b7183f8.pdf | 9,745,554 | `5dc2cdb534b76c2c3e3c89e3145c255c1ded89b1372bcbe93b242432c614dc40` |

Every page cited below reads word for word the same in both copies (compared by the gazette page number
printed in each running head; they differ only in the code points the equation fonts extract to).

## The files

- `bnbc2020-p6-column-transverse.excerpt.pdf` — 25 pages imported UNMODIFIED from the primary PDF with
  pypdfium2 5.13.0; 1,323,218 bytes, sha256 `f8ea16e2048c6dc9ca012ec265f5977450c3f200275526853f0820f405905997`.
  A page import is not byte-reproducible across tools, so the proof of provenance is the primary copy's
  hash plus the page map below, not this file's hash.
- `bnbc2020-p6-column-transverse.clauses.txt` — the clauses transcribed verbatim with G / BGP / HBRI page
  references (mathematical symbols from the rendered page, the rest the PDF's own text layer; the
  printing's figures are illegible scans and are not transcribed).

## Page map (G = gazette page printed in the running head; BGP = page of the primary PDF)

G 2583 (BGP 1, the notification) · G 3061 (480, Table 6.1.1 occupancy) · G 3196 (615, Table 6.2.15:
Dhaka Z = 0.20, zone 2) · G 3198 (617, §2.5.5.2 and Table 6.2.18, seismic design category) · G 3491 (910,
§6.3.9.3 spirals, Eq. 6.6.12) · G 3506 (925, Eq. 6.6.55) · G 3518 (937, §6.4.9.2 joint ties) ·
G 3643–3647 (1062–1066, §8.1 scope, §8.1.1.1 CROSS TIE / HOOP, §8.1.2 hooks and bends) ·
G 3654–3655 (1073–1074, §8.1.9.3 spirals, §8.1.9.4 ties: spacing 16 d / 48 d_tie / least dimension, lateral
support of alternate bars, first and last tie) · G 3669–3670 (1088–1089, §8.3.2 which provisions apply
by SDC) · G 3676 (1095, §8.3.5.1 SMF scope) · G 3678–3680 (1097–1099, §8.3.5.4 SMF columns, Fig 6.8.8
note) · G 3690–3691 (1109–1110, §8.3.7.2–3 SMF joints) · G 3694–3696 (1113–1115, §8.3.9.2 ordinary,
§8.3.10.2 and §8.3.10.5 IMF columns).

## What is NOT here

ACI 318-19, which S-01 cites "WHERE THE CODE IS SILENT", is copyrighted and is not vendored. On the
clauses the derivation needs, BNBC 2020 is not silent (ℓo, s₀, the spacing beyond ℓo, cross-ties, hooks,
circular ties and spirals are all stated), so no ACI text is needed.

## Contradictions inside the code itself, recorded where a reader will meet them

- §8.3.9.2(a) allows a tie hook extension of "6 tie bar diameter or 60 mm"; every other clause says 75 mm.
- §8.3.9.2(a) cites "Sec 8.3.2" for the cross-tie definition, which stands in §8.1.1.1.
- §8.1.2.1(d) lets a circular hoop bend 90°; the HOOP definition (§8.1.1.1) asks 135°.
