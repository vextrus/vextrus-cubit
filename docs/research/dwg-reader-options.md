# DWG reader options for a hosted Vextrus: cost, licence and risk

Question: for a hosted SaaS in Bangladesh that reads its clients' DWG files on its own servers, what do
LibreDWG 0.14, ACadSharp, Autodesk Platform Services (APS) Automation API for AutoCAD (formerly
"Design Automation"), the ODA Drawings SDK and Aspose.CAD each cost, permit and risk? This includes
the ODA File Converter, which ezdxf's `odafc` add-on shells out to.

Researched 2026-09-26 (Dhaka). All sources were accessed that day unless a note says otherwise. They
are vendor price pages and PDFs, licence and terms texts, API docs, the GitHub API, the NVD CVE API,
and latency measured with curl from this machine in Dhaka. Decoding **accuracy** on our real files is
out of scope here; a separate measurement agent covers it. Context read first: ADR 0018 (hosted, with
dedicated deployments later), ADR 0020 (LibreDWG runs as a sandboxed subprocess), ADR 0023/
`docs/research/stack-deploy.md` (beta in AWS `ap-south-1` Mumbai) and `docs/research/2d-to-bim-approaches.md`
§2 and §5.

This is research, not legal advice. Every licence reading below should go to a lawyer before money
is spent or a client contract signed.

---

## Conclusions (ranked)

1. **LibreDWG 0.14.x as the primary reader, run as a sandboxed subprocess. Keep it.** It costs $0
   plus compute. GPLv3 puts no obligation on a service we operate, because network use is not
   "conveying" [R1]. It reads every DWG version from R13 to R2018 (AC1032), and "just some very
   advanced R2010+ objects fail to read and are skipped over" [R3].
   - **Security is its weak point.** NVD lists 13 LibreDWG CVEs published in 2026. Seven of them,
     from May 2026, affect "up to 0.14", in the R2004 decompression and entity-walk code [R5]. Pin
     the newest 0.14.x build (0.14.8597, 10 Sep 2026 [R4]) and run it with a time limit, a memory
     limit, no network and a throwaway working directory.
   - **It rests on one maintainer.** One person has 6,895 of the roughly 7,660 commits among the
     top five contributors [R4].
2. **ACadSharp as the second, independent decoder. Adopt it.**
   - $0; MIT; reads AC1014–AC1032 [R7].
   - It is the most actively maintained option: 70–160 commits every month for the last 12 months,
     and releases v3.7.1 → v3.8.0 in August–September 2026 [R8].
   - It needs a .NET runtime and a small console tool of ours. That fits ADR 0020's
     "subprocess" pattern.
   - **Caveat on "independent":** both libraries are written against the ODA's published "Open
     Design Specification for .dwg" [R3, R9]. Errors in that spec can show up in both, so when
     the two agree it is not proof they are right.
   - An open issue reports AC1032 `INSERT`s silently lost in a read/write round trip; it is not yet
     known whether the read side is at fault [R10].
3. **APS Automation API for AutoCAD: use it as a development-time arbiter on drawings we own, not on
   every client upload.** It is real AutoCAD, so it is the closest thing to ground truth there is.
   It is cheap: **$3 per 12 minutes of processing = $0.25 per minute**, billed per second including
   download and upload [R11, R12]. It comes to about **$0.06–$0.25 per 5–20 MB drawing** at an
   *estimated* 15–60 s per job (not measured: that needs an account, and none was created). The
   Free tier gives 5 hours a month [R11].
   Four things weigh against running it on every client upload:
   - **It runs in the USA.** Processing and reports are in AWS `us-east-1`. The job API has no
     region choice, even though APS storage now offers an India region [R13, R14, R15].
   - **Its terms bite.** The terms bar "a competitive product or service, as determined by Autodesk
     in its sole discretion" [R16 §6.1(d)], and Autodesk sells a takeoff product (Forma Takeoff)
     [R18]. They forbid an application whose substantial value is file translation [R16 §7.1]. They
     forbid uploading "End User Personal Data" [R16 §11.3], and title blocks carry people's names.
     And Autodesk may use the uploaded content "in connection with providing and improving"
     its products [R16 §6.6, §7.5].
   - **It needs a Windows AutoCAD plug-in.** That is a third code path to write and to migrate
     whenever Autodesk retires an engine (about four years supported, then two years
     deprecated) [R17].
   - **Each job pays a US round trip.** 260 ms TCP RTT measured from Dhaka to `us-east-1` (§7).

   The Sample Project is drawn by the team (ADR 0004), so running it through APS carries none of
   the client-data risk. That makes it the right first answer key for the two free decoders.
4. **ODA Drawings SDK, Sustaining membership: the paid upgrade if measurement shows the free pair
   failing on real files.** It is the reference-grade DWG library (reads AC1009–AC1032 [R20]).
   - Cost: **$7,500 in the first year, then $4,500 a year** [R19].
   - **Sustaining is the lowest tier that permits "Web/SaaS use".** Commercial ($3,000, then $2,250)
     does not [R19].
   - "Unlimited commercial distribution" also covers dedicated deployments [R19].
   - Lock-in is the subscription itself: stop paying and "you lose the right to distribute the
     ODA-based product" [R21].
   - This corrects `2d-to-bim-approaches.md` §2, which had $6K then $3.6K from a search summary.
5. **Aspose.CAD: no reason to choose it.** SaaS needs the Developer OEM licence at **$2,397 per
   developer**; Small Business ($799) excludes SaaS [R22]. It is closed source; its EULA was not read
   (§5); and it has no evidence of better DWG fidelity than the free pair.
6. **ODA File Converter / ezdxf `odafc`: not usable for Vextrus.** The outside review is right.
   ODA: "If you are not an ODA member, you can use them for non-commercial applications only"
   [R23]. The Community User Agreement also forbids use "in any timesharing or service bureau
   arrangement" and forbids distributing it "as part of any commercial application" [R24]. ezdxf's
   documentation says nothing about the licence [R25].

**Recommended shape.** Both free decoders run on every upload, in Mumbai. Each emits DXF. ezdxf reads
both, and the engine compares the two entity inventories. A disagreement becomes a Question for the
QS, not a call to a paid arbiter. APS runs only on the team's own drawings (the Sample Project) to
measure the pair during development. Buy ODA Sustaining only if the measurement shows a material
share of real files where both free decoders are wrong. Whether client drawings may ever go to
Autodesk (US) is the owner's decision: ADR 0013 covers TypeSafe, not Autodesk.

**A correction to ADR 0018's reasoning (not its decision).** A dedicated deployment in a client's
cloud account would install LibreDWG on the client's machines. That is "conveying" under GPLv3 [R1
§0]. But it does not force Vextrus's own code under the GPL while LibreDWG stays a separate program
talking through files and a command line: that is an "aggregate" [R1 §5; R2]. We would then have to
ship LibreDWG's source and licence with the deployment and not restrict the client's GPL rights. The
licence stays manageable. It is not simply "unclean".

---

## 1. LibreDWG 0.14 (GNU, GPL-3.0-or-later)

| Aspect | Finding | Source |
|---|---|---|
| Licence on our servers | GPLv3 §0: "Mere interaction with a user through a computer network, with no transfer of a copy, is not conveying." A hosted service therefore has no source-release duty, even for a modified LibreDWG. (The GPL is not the AGPL.) | [R1] |
| Dedicated deployment | Copies land on the client's infrastructure, so it counts as conveying. We would give the Corresponding Source and the licence text. Vextrus stays proprietary if the two are separate programs: GPLv3 §5 "aggregate"; FSF: "pipes, sockets and command-line arguments are communication mechanisms normally used between two separate programs", but "if the semantics of the communication are intimate enough … that too could be a basis to consider the two parts as combined". Keep the interface to files (DWG in, DXF/JSON out). **Never link the C library or its Python bindings.** | [R1, R2] |
| Cost | $0 licence. Compute on the existing worker: a c7g.large in Mumbai is $0.0491/h (`stack-deploy.md`), so a 10 s job costs about $0.00014. Per-drawing CPU time is being measured separately | [R26] |
| Versions | README: "our decoder (i.e. reader) is done, it can read all DWG versions, just some very advanced R2010+ objects fail to read and are skipped over." `dwg2dxf`: "About 90% coverage." 0.14 adds r2004 *writing*; r2010–r2018 writing still gives CRC errors (irrelevant to reading) | [R3, R6] |
| Known weaknesses | Status "beta" (NEWS 0.14 header). TABLE/TABLECONTENT and dynamic-block classes are "unstable" (manual, cited in `2d-to-bim-approaches.md` §2). 0.14 fixed many fuzzing crashes (ossfuzz, GH #1251/#1254/#1255) | [R6] |
| Security | NVD: 98 LibreDWG CVEs in all; 13 were published in 2026. CVE-2026-9500/9501/9502/9530 (R2004 decompression) and CVE-2026-9503 (`dwg_next_entity`) affect "up to 0.14"; CVE-2026-90622 (14 Sep 2026) is against 0.13.4. Whether 0.14.8597 fixes each one was **not checked** | [R5] |
| Maintenance | Last stable 0.14 (27 Jun 2026); pre-release builds 0.14.8583–0.14.8597 run 17 Aug–10 Sep 2026. Commits: 125 (Mar), 66 (Apr), 27 (May), 111 (Jun), 88 (Jul), 34 (Aug), 3 (Sep, to date) 2026. Top contributor: 6,895 commits; the next: 338 | [R4] |
| Lock-in | None: a file-in, file-out subprocess | — |
| Risk | Crashes and CVEs on untrusted input; a single maintainer (bus factor); GPL mistakes if someone links it | — |

## 2. ACadSharp (MIT)

| Aspect | Finding | Source |
|---|---|---|
| Licence | MIT (GitHub licence field; `PackageLicenseExpression` MIT). Its submodule CSUtilities is MIT too. Keep the copyright notice in any distribution, so dedicated deployments are free of licence trouble | [R7, R8] |
| Cost | $0 plus compute. Needs .NET 8/9/10 (targets net8.0–net10.0, netstandard2.0/2.1, net48) | [R7] |
| Versions | DwgReader: AC1014, AC1015, AC1018, AC1021, AC1024, AC1027, AC1032. DwgWriter: all of these except AC1021 | [R7] |
| Known weaknesses | 24 open issues labelled bug. #1172 (31 Jul 2026, open): "Insert entities silently dropped when reading AC1032 (R2018) DWG files", 6 of 9 inserts lost in a read/write round trip, "no exception, no notification". #1180: DwgReader leaves LEADER text width/height at 0. #1253: its DXF output rejected by AutoCAD (group-code errors). This matters if we route ACadSharp → DXF → ezdxf | [R10] |
| Maintenance | Commits a month, Sep 2025–Sep 2026: 20, 121, 162, 103, 105, 73, 54, 85, 135, 95, 135, 81, 70. Releases: v3.5.7 (2 May 2026) … v3.8.0 (21 Sep 2026). One lead maintainer (4,238 commits; the next has 123) | [R8] |
| Independence | Its CONTRIBUTING points to "the Open Design document in the reference folder for Dwg", the same ODA spec LibreDWG works from | [R9, R3] |
| Integration | A small console tool (`dotnet publish`, linux-arm64 or x64) that writes DXF (for ezdxf) or JSON. It runs as a subprocess, exactly like LibreDWG. That adds a .NET runtime to the one worker image (ADR 0020 forbids a separate *Python* service; a subprocess is not one) | — |
| Lock-in | None | — |
| Risk | Silent loss (#1172); a single maintainer; the DXF writer's quirks | — |

## 3. APS Automation API for AutoCAD ("Design Automation")

**Price.** The APS business model changed on 8 Dec 2025 [R12]. Automation API: AutoCAD is "1 token
or $3 for 12 minutes"; the Free tier includes "5 hours" a month (rate chart dated 11/12/2025) [R11].
The rate chart is a JPEG inside [R12]. Other details from [R12]:
- Once on a Paid tier, the free caps end: "usage of paid APIs is metered and billed based on actual
  consumption".
- Flex tokens: "The minimum purchase is 100 tokens"; "Tokens expire one year from the purchase date".
- Pay as You Go: "Availability varies by region" (not confirmed for Bangladesh).

A Flex token costs $3.00 in the US, down to $2.40 at volume (from 5,000 tokens) [R27]. Billing:
"billed based on the number of seconds the workitem takes to run", counting from
`timeDownloadStarted` to `timeUploadEnded`, so download and upload are billed too [R13].

| Seconds per job (**estimate**, not measured) | Cost per drawing | 2,000 drawings/yr | 20,000 drawings/yr | Free tier covers per month |
|---|---|---|---|---|
| 15 s | $0.06 | $125 | $1,250 | 1,200 jobs |
| 30 s | $0.13 | $250 | $2,500 | 600 jobs |
| 60 s | $0.25 | $500 | $5,000 | 300 jobs |

*Why 15–60 s:* no source publishes AutoCAD job times for small DWGs. Autodesk's 2020 cost blog
measured "around 30 seconds to download or upload" a 400 MB file [R13]; a 5–20 MB file moves in far
less. The AutoCAD engine's default job limit is 100 s (maximum 3,600 s) [R14], which implies
Autodesk expects short jobs. The real figure comes from `stats` in the work-item response once an
account exists.

**Where it runs.**
- The job API root is `https://developer.api.autodesk.com/da/us-east/v3/*`.
- Work-item reports sit in `dasprod-store.s3.us-east-1.amazonaws.com`.
- AutoCAD callbacks come from AWS us-east IPs.
- Autodesk's own blog says Automation servers use "AWS us-east" [R13, R14, R15].
- APS *storage* (OSS) offers US, EMEA, AUS, CAN, DEU, **IND**, JPN and GBR [R28], but no
  regional variant of the Automation API was found: `/da/eu-west/` returns 404 (checked with curl).
- Input may be any signed URL, such as an S3 presigned URL from Mumbai, so the DWG crosses to
  us-east-1 for each job.

**Retention.**
- Work-item status "is retained for 3 days after the WorkItem completes"; the report URL is valid
  for 24 hours [R29].
- Deleted content "may persist in backup and archival copies" [R16 §14].
- **Not found:** how long Automation workers keep input files after a job.

**Terms that could bite** (APS Terms, "Last Updated: April 28, 2026") [R16]:
- §6.1(c)–(d): no Application that "functions substantially the same as any Developer Offering",
  and no use "for the purpose of building or providing a competitive product or service, as
  determined by Autodesk in its sole discretion". §11.2: "You may not access or use Developer
  Offerings if You are a competitor of Autodesk." Autodesk sells **Forma Takeoff**, "2D takeoffs
  and … automated quantities from 3D models" with unit costs [R18]. Vextrus's Takeoff and Priced
  BOQ overlap it, so the risk is real, though it is Autodesk's call.
- §7.1: file translation must be "an incidental part"; no "automated translation service", and
  nothing "where a substantial portion of the value of Your Application is to provide translation
  from one file format to another". Reading DWG inside a Takeoff product is arguably incidental.
  Not tested.
- §11.3: "You will not … upload … any Sensitive Personal Data or End User Personal Data." Title
  blocks name engineers, architects and owners.
- §6.6 and §7.5: Autodesk may use uploaded content "in connection with providing and improving
  Autodesk products and services". Our client agreement would have to say so (§7.5(c)).
- §11.1: Autodesk may demand "a copy of each of Your Applications and one or more test accounts",
  and may suspend us "in its sole discretion".
- Accounts: an Autodesk account, an APS account and a developer hub are required. The Free tier
  needs "a payment method … to verify your identity" [R11-page].
- Limits: 150 calls a minute to `GET workitems`; the AutoCAD job default is 100 s; there is an
  optional monthly processing-hour cap (`limitMonthlyProcessingTimeInHours`) [R14].

**Versions.** It is AutoCAD itself: the 2027 engine (`Autodesk.AutoCAD+26_0`) was released 9 Apr
2026. The engine lifecycle is about four years supported, then two years deprecated, then removal:
the 2021 engine (24_0) is being removed [R17]. AutoCAD reads every DWG version (vendor fact; no
separate citation).

**Build cost.** We would write an AutoCAD .NET or AutoLISP "AppBundle" that opens the DWG and writes
DXF or JSON, plus the OAuth, upload and callback plumbing. It runs in a low-privilege Windows sandbox
with a 260-character path limit [R15].

**Dedicated deployment.** The client's DWGs would still go to Autodesk US. A client who asks for a
dedicated deployment for data-control reasons would probably refuse this. (This is an inference.)

**Lock-in.** Low if the seam is DXF out. The AppBundle is AutoCAD-specific code, but it is small.

## 4. ODA Drawings SDK (Open Design Alliance)

| Aspect | Finding | Source |
|---|---|---|
| Price (2026 PDF) | Commercial: $3,000 first year, $2,250 renewal; up to 100 redistributed copies; **Web/SaaS use: No**. **Sustaining: $7,500 first year, $4,500 renewal; unlimited redistribution; Web/SaaS use: Yes**. Founding: $37,500 / $18,000, adds source code. Pricing page: "Sustaining: Web and SaaS usage permitted … Unlimited commercial distribution … No affiliate or subsidiary usage". Credit card adds 4% | [R19] |
| Subscription | "ODA SDKs licensed through an annual subscription model. In case of termination of the subscription you lose the right to distribute the ODA-based product, even if it was developed during the validity of the license." Non-commercial membership: "you cannot to commercialize your product" | [R21] |
| Rules that bite | Membership Rules (27 Oct 2025): §19 no use "in acting as a service bureau … except as expressly provided in its Membership Agreement" (Sustaining's agreement provides SaaS; the agreement itself is not public and was **not read**). §9 audit and §10 tracking: ODA may audit records and demand "an executable copy of any Member Application". §21 Code of Conduct: no statement that could "cast in a negative light" the ODA or its tools. §3: the rules can change on 90 days' notice. "Member" excludes a "parent, subsidiary or affiliate", so a future Gulf subsidiary would need its own membership. §14: sanctions representations (Bangladesh is not a listed country) | [R30] |
| Versions | "AutoCAD 12 (AC1009)–AutoCAD 2009 (AC1021) … AutoCAD 2018–2025 (AC1032)". Release 27.8 (4 Sep 2026), with monthly maintenance releases. Linux supported; C++, .NET, Python and Java wrappers | [R19, R20] |
| Where it runs | In our own process on our own servers, so the data stays in Mumbai | — |
| Dedicated deployment | Allowed under Sustaining ("Unlimited commercial distribution") | [R19] |
| Lock-in | High in money (pay every year or lose the right to run it); low in code if it sits behind the DXF seam | [R21] |
| Risk | A fixed cost before revenue; the membership agreement's exact SaaS clause is not public | — |

## 5. Aspose.CAD (commercial), briefly

- **Price** (same for .NET and Python via .NET) [R22]:
  - Developer Small Business, $799: 1 developer, 1 location, **no SaaS**.
  - **Developer OEM, $2,397**: 1 developer, unlimited locations; "Allows distribution of derived
    works to public facing websites/applications, extranets, multi-site intranets or SaaS".
  - Developer SDK: $15,980.
  - Metered: from $1,999 a month.
- **Licence terms.** A purchase "entitles you to one year of product updates"; after that "you are
  still licensed to use the product". "Each developer working with Aspose products needs to be
  licensed" [R22].
- **Versions.** Product pages list DWG 2000 through 2024. The .NET/Java list skips 2007 (AC1021)
  [R31], which is **not confirmed** either way.
- **Package.** The Python package `aspose-cad` 26.7.0 (30 Jul 2026) ships manylinux x86_64, but no
  Linux ARM wheel [R32]. The Graviton instances in `stack-deploy.md` would therefore need x86.
- **Not read:** the EULA (2026-05-05 PDF, behind a viewer link) [R33].

## 6. ODA File Converter and ezdxf `odafc`

- ODA FAQ: "ODA Viewer and ODA File Converter are example projects … free downloads … **If you are
  not an ODA member, you can use them for non-commercial applications only.**" [R23]
- The ODA Community User Agreement (5 Sep 2025) covers "free stand-alone utilities". Users "may not
  directly or indirectly resell or distribute a Community Application … as part of any commercial
  application" and may not "use any Community Application … in any timesharing or service bureau
  arrangement" [R24].
- ezdxf's `odafc` page says only that "The ODA File Converter has to be installed by the user". It
  suggests `xvfb` on Linux and warns: "Execution of an external application is a big security
  issue!" It is silent on licensing [R25].
- **Conclusion:** running it on our server for paying clients is not permitted without a
  membership. **Unclear:** whether a Sustaining member may run the File Converter itself on a
  server; members would use the SDK anyway.
- The LibreDWG maintainers use ODAFileConverter in their own CI (0.14 NEWS) [R6]. That is a
  development use and no precedent for us.

## 7. Latency from Dhaka (measured 2026-09-26, 04:19–04:29 Dhaka time, curl, 9 runs each, medians)

| Target | Resolves to | TCP connect (RTT) | Server wait after TLS | Total |
|---|---|---|---|---|
| `developer.api.autodesk.com/` | 34.160.78.217 (a Google Cloud anycast front end) | 52 ms (46–104) | 64 ms | 222 ms |
| `…/da/us-east/v3/engines` (401 without a token) | same | 51 ms | 64 ms | 239 ms |
| `…/da/us-east/v3/health/autocad` (200, "Fully Operational") | same | 53 ms | **701 ms** | 845 ms |
| `dasprod-store.s3.amazonaws.com` (Automation job storage) | 52.217.136.34 (us-east-1) | **265 ms** | 283 ms | 892 ms |
| `s3.us-east-1.amazonaws.com` | 52.217.133.48 | 260 ms | 260 ms | 825 ms |
| `s3.ap-south-1.amazonaws.com` (our beta region) | 52.219.156.77 | 44 ms | 48 ms | 174 ms |

- **Reading.** The APS hostname ends at a nearby edge (about 50 ms). The Automation back end and its
  storage are in us-east-1, about 260 ms RTT from Dhaka. From our Mumbai server it would be about
  227 ms Mumbai–IAD (Zenlayer, cited in `stack-deploy.md`).
- **Per job.** Each job adds several round trips: token, POST workitem, the worker's download from
  Mumbai S3, callback or poll. On top come queueing (`approximateQueuePosition` exists, so jobs can
  queue [R29]) and processing. The **end-to-end seconds per drawing were not measured**; that needs
  an account.
- **Local readers** (LibreDWG, ACadSharp, ODA, Aspose) add no network latency.

## 8. Lock-in, if the reader sits behind an interface

Make the seam **"DWG path in → DXF file (plus a JSON manifest: version, entity counts, warnings)
out"**, read by ezdxf. Every option can produce DXF:
- LibreDWG: `dwg2dxf`.
- ACadSharp: `DxfWriter`.
- ODA: saves DXF.
- AutoCAD on APS: `DXFOUT` / SaveAs.
- Aspose: DXF save is "partially supported" [R34].

Switching readers then costs one adapter (tens to a few hundred lines) plus re-running the
real-drawing check. The real lock-in is elsewhere:
- **ODA:** money every year [R21].
- **APS:** the Autodesk account, the terms, and engine retirements every few years [R16, R17].
- **All options:** fixtures and tolerances tuned to one reader's DXF quirks. Keep per-reader golden
  files.

## 9. Comparison

| Option | Licence (hosted / dedicated) | Cost per drawing | Cost per year | Latency (network) | Lock-in | Main risk |
|---|---|---|---|---|---|---|
| LibreDWG 0.14 | GPL-3.0+: free to run as a service; ship source if deployed in a client's cloud | ≈ $0 (compute) | $0 | none (local, Mumbai) | none | CVEs on untrusted files; one maintainer; beta |
| ACadSharp | MIT: free both ways | ≈ $0 (compute) | $0 | none | none | Silent entity loss (#1172); one maintainer; .NET in the image |
| APS Automation (AutoCAD) | Proprietary terms; SaaS allowed with competitor, translation and personal-data limits | ≈ $0.06–$0.25 (**estimate**, $0.25/min) | $125–$5,000 at 2k–20k drawings; 5 h/month free on the Free tier | +≈ 227–260 ms RTT per call to us-east-1, plus queue and processing | medium (account, terms, engine lifecycle) | "Competitor" discretion (Forma Takeoff); data in the USA; personal data in title blocks |
| ODA Drawings SDK (Sustaining) | Proprietary; Web/SaaS and distribution allowed | fixed: $3.75 → $2.25 at 2k/yr; $0.38 → $0.23 at 20k/yr | $7,500, then $4,500 | none | high money, low code | Pay forever; unpublished agreement terms; non-disparagement clause |
| Aspose.CAD (Developer OEM) | Proprietary; OEM allows SaaS | fixed | $2,397 per developer (1 yr updates; renewal price not shown) | none | medium | No fidelity evidence; x86 only on Linux; EULA unread |
| ODA File Converter / `odafc` | Non-members: non-commercial only; no service bureau | — | — | — | — | **Not permitted** |

## 10. What is not known, and where the question outruns the sources

- **Accuracy on our files.** Left to the measurement agent. Every ranking above assumes the free
  pair is good enough on real Dhaka consultant DWGs, which is not yet shown.
- **APS: seconds per drawing and queue time.** Needs an account (none was created, by the rules of
  this task). The 15–60 s figure is an estimate.
- **APS: whether Autodesk would call Vextrus "competitive".** It is at Autodesk's "sole discretion"
  [R16]; no source can settle it. Whether Flex or Pay as You Go can be bought from Bangladesh is
  also unconfirmed.
- **APS: retention of inputs on Automation workers.** Not documented where we looked.
- **ODA:** the text of the Sustaining Membership Agreement (its §2.1.2 "Internet/SaaS/Web-Based
  Applications" is cited by a search summary but was not read). Also whether a member may run the
  File Converter on a server.
- **LibreDWG:** which 2026 CVEs 0.14.8597 fixes.
- **Aspose:** the EULA, and whether 2007 (AC1021) DWG is read.
- **GPL:** whether running LibreDWG in a client's cloud account *under our operation* is
  "conveying" or falls under GPLv3 §2 ("facilities for running those works … exclusively on your
  behalf"). The safe course is to treat it as conveying and comply, which is cheap.

---

## Sources (all accessed 2026-09-26)

- [R1] GNU GPL v3 text (§0 "convey", §2, §5 aggregate): https://www.gnu.org/licenses/gpl-3.0.txt
- [R2] GNU GPL FAQ, "Where's the line between two separate programs…" and "aggregate": https://www.gnu.org/licenses/gpl-faq.html#MereAggregation
- [R3] LibreDWG README (master): https://github.com/LibreDWG/libredwg/blob/master/README
- [R4] GitHub API, LibreDWG releases, commits since 2025-09-26, contributors: https://api.github.com/repos/LibreDWG/libredwg/releases ; https://github.com/LibreDWG/libredwg/releases/tag/0.14
- [R5] NVD CVE API, keyword "libredwg" (98 results): https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=libredwg
- [R6] LibreDWG NEWS at tag 0.14: https://github.com/LibreDWG/libredwg/blob/0.14/NEWS
- [R7] ACadSharp README and `ACadSharp.csproj`: https://github.com/DomCR/ACadSharp ; https://github.com/DomCR/ACadSharp/blob/master/src/ACadSharp/ACadSharp.csproj
- [R8] GitHub API, ACadSharp releases, commits, contributors; CSUtilities licence: https://api.github.com/repos/DomCR/ACadSharp ; https://github.com/DomCR/CSUtilities
- [R9] ACadSharp CONTRIBUTING: https://github.com/DomCR/ACadSharp/blob/master/.github/CONTRIBUTING.md
- [R10] ACadSharp open bug issues, incl. #1172, #1180, #1253: https://github.com/DomCR/ACadSharp/issues/1172 ; https://github.com/DomCR/ACadSharp/issues?q=is%3Aissue+is%3Aopen+label%3Abug
- [R11] APS API rate chart (11/12/2025), image in [R12]: https://aps.autodesk.com/sites/default/files/inline-images/API%20Rate%20Chart_11-12-25-1.jpg ; APS pricing section: https://www.autodesk.com/products/autodesk-platform-services/overview#pricing
- [R12] APS blog, "APS Business Model Evolution" (7 Dec 2025, FAQ): https://aps.autodesk.com/blog/aps-business-model-evolution
- [R13] APS blog, "Estimate Automation costs" (30 Jan 2020; per-second billing, "AWS us-east"): https://aps.autodesk.com/blog/estimate-design-automation-costs
- [R14] Automation API rate limits and quotas: https://aps.autodesk.com/en/docs/design-automation/v3/developers_guide/rate-limits/da-rate-limits/
- [R15] Automation API restrictions (endpoints, callback IPs, sandbox): https://aps.autodesk.com/en/docs/design-automation/v3/developers_guide/restrictions/ ; field guide (report URL in us-east-1): https://aps.autodesk.com/en/docs/design-automation/v3/developers_guide/field-guide/
- [R16] Autodesk Platform Services Terms (last updated 28 Apr 2026), §§6.1, 6.6, 7.1, 7.5, 11.1–11.3, 14: https://www.autodesk.com/company/legal-notices-trademarks/terms-of-service-autodesk360-web-services/forge-platform-web-services-api-terms-of-service
- [R17] APS blog, "End of AutoCAD 2021 Engine, New AutoCAD 2027 Engine Released" (9 Apr 2026): https://aps.autodesk.com/blog/end-autocad-2021-engine-new-autocad-2027-engine-released
- [R18] Autodesk Forma Takeoff (search result pages; the product page returned 403 to curl): https://construction.autodesk.com/tools/construction-takeoff-software/ ; https://www.autodesk.com/products/forma-takeoff/overview
- [R19] ODA pricing page and "Membership Levels and SDK Extensions Pricing" PDF (2026): https://www.opendesign.com/pricing ; https://www.opendesign.com/agreements/2026/en/ODA%20Membership%20&%20Extension%20pricing.pdf
- [R20] ODA Drawings SDK product page (supported DWG versions): https://www.opendesign.com/products/drawings
- [R21] ODA pricing FAQ (annual subscription; loss of distribution rights): https://www.opendesign.com/pricing
- [R22] Aspose.CAD pricing (Python via .NET; .NET identical): https://purchase.aspose.com/pricing/cad/python-net/ ; https://purchase.aspose.com/pricing/cad/net/
- [R23] ODA FAQ, "What are ODA Viewer and ODA File Converter?": https://www.opendesign.com/faq/question/what-are-oda-viewer-and-oda-file-converter
- [R24] ODA Community User Agreement (5 Sep 2025): https://www.opendesign.com/agreements/2025/en/ODA%20Community%20User%20Agreement%2009-2025.pdf
- [R25] ezdxf docs, ODA File Converter add-on: https://ezdxf.readthedocs.io/en/stable/addons/odafc.html
- [R26] `docs/research/stack-deploy.md` (AWS Mumbai prices; Zenlayer Mumbai–IAD 227 ms)
- [R27] Autodesk Flex (token price $3.00, volume tiers to $2.40, "based on $3 global SRP per token"): https://www.autodesk.com/buying/flex
- [R28] APS OSS `POST buckets` (`x-ads-region` values; retention policies): https://aps.autodesk.com/en/docs/data/v2/reference/http/buckets-POST/
- [R29] Automation API `GET workitems/:id` (3-day retention; 24 h report URL; queue position): https://aps.autodesk.com/en/docs/design-automation/v3/reference/http/workitems-id-GET/
- [R30] ODA Membership Rules and Policies (27 Oct 2025): https://www.opendesign.com/agreements/2025/en/ODA%20Membership%20Rules%20and%20Policies%20-%20Oct%2027%202025%20Oct.pdf
- [R31] Aspose.CAD product page (DWG versions, via search summary): https://products.aspose.com/cad/net/ ; enum list: https://reference.aspose.com/cad/net/aspose.cad.fileformats.cad.cadconsts/cadacadversion/
- [R32] PyPI JSON, `aspose-cad`: https://pypi.org/pypi/aspose-cad/json
- [R33] Aspose EULA landing page: https://about.aspose.com/legal/eula
- [R34] Aspose.CAD supported file formats: https://docs.aspose.com/cad/python-net/supported-file-formats/
