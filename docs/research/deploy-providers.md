# Where to host the beta: GCP, AWS, the cheaper clouds, or our own DevOps

Question (the owner, 27 Sep 2026): "why not try GCP instead of AWS as we've already used GCP
previously before for our vextrus and currently we're under subscribed to GCP payment … or do we have
any more cheap but reliable services rather than AWS, GCP or Azure - do we have customizable options
if we maintain DevOps ourself??"

Researched 27 Sep 2026 for session 02. It extends `docs/research/stack-deploy.md` (25 Sep), which
priced AWS Mumbai, DigitalOcean, Vultr, Hetzner and the PaaS options but not GCP or Azure. Inputs
read first: ADR 0034 (the stack), ADR 0031 §7–§10 (the CAD worker's memory cap and concurrency 1;
the DWG readers sandboxed with no network and a read-only filesystem, "a locked-down sibling
container in the beta"; x86, not ARM; staging with its own small database), ADRs 0018 and 0029, and
`docs/research/global-markets-foundation.md` §0 (AWS's UAE region damaged and Bahrain unavailable in
2026, so backups belong in a second region from the beta).

**Sources.** `[S#]` are vendor pages, docs, price files and APIs, all read on 27 Sep 2026 (the list
is at the end). `[M#]` are measurements from the owner's WSL2 machine in Dhaka on 27 Sep 2026. Azure
was not priced (the owner asked about GCP and cheaper providers). Nothing from the real drawings was
used.

**Prices** are USD a month, on demand, before tax, at 730 hours, unless stated. INR is converted at
the ECB rate of 25 Sep 2026, 1 USD = ₹95.82 [S50].

**Confidence.** *High*: a primary source says it and I read it, or I measured it. *Medium*: a
primary source read through a search summary, or plain arithmetic on primary prices. *Low*: my
judgement or estimate; marked "(estimate)".

**The beta's shape, used for every provider** (from the brief and ADRs 0031 and 0034):
- one x86 VM of 4 vCPU and 8–16 GB running the web and worker containers;
- managed Postgres, with point-in-time restore (PITR) as long as the provider allows up to 14 days;
- 100 GB of object storage (the brief says 50–200 GB);
- a small staging VM (2 vCPU, 4 GB) and its own small database;
- database backups and objects copied to a second region;
- about 50 GB a month of traffic out to users (estimate).

---

## 0. What is broken, uncertain or unmeasured (read first)

1. **ADR 0034's beta price is out of date: "$87–123 a month" was for a 2-vCPU ARM VM.** It came from
   `stack-deploy.md`, which priced a t4g.large (2 vCPU, 8 GB, Graviton) and put staging's database on
   the production RDS instance. ADR 0031 has since moved the beta to x86 and given staging its own
   database. At the shape above, AWS Mumbai costs about **$158–174** (§4). AWS's prices themselves
   have not changed since 25 Sep (High, [S27][S28]).
2. **GCP's latency was not measured from a VM.** No GCP account was used.
   - TCP handshakes to Google's regional storage endpoints gave Mumbai 44.5 ms and Delhi 35 ms
     [M3]. AWS Mumbai gave 45–54 ms by the same method [M2].
   - A warm HTTP round trip through Google's front end to a Cloud Run service gave 79–84 ms for
     Mumbai [M1]. A VM with its own IP would not take that path.
   - I infer that the regional endpoints end inside the region, because the Middle East ones
     answer in about 280 ms. That is an inference, not a documented fact.
   - One hour of an e2-micro VM in `asia-south1`, using the owner's GCP account, settles it.
3. **Google lists the N2D machine type in Mumbai at about a third below its US price**, and below
   E2 in the same region. Two Google pages agree:
   - the pricing page with Mumbai selected: n2d-standard-4 at $0.111532 an hour [S1];
   - the SKU catalogue: N2D core at $0.018151 an hour in Mumbai against $0.027502 in the Americas
     [S2].

   It looks like a regional price cut or an error in Google's catalogue. **Check the console's
   estimate before relying on it.** If it is wrong, the GCP VM line rises from about $65 to about
   $118 (e2-standard-4).
4. **GCP cannot give 14 days of PITR cheaply.**
   - Cloud SQL Enterprise edition keeps transaction logs for at most 7 days. 14 days (up to 35)
     needs Enterprise Plus [S4][S5].
   - The smallest Enterprise Plus machine has 2 vCPU and 16 GB [S7]. In Mumbai it costs about $221
     a month [S3], against about $59 for the smallest dedicated Enterprise machine.
   - Cloud SQL's SLA excludes single-zone and shared-core instances [S8]. A cheap beta database on
     GCP therefore has **no SLA**. RDS Single-AZ has a 99.5 % SLA [S30].
5. **Whether `bwrap` runs inside any managed container platform is unmeasured.** The docs make it
   unlikely on GKE Autopilot and possible on Cloud Run's second generation (§3.6). On a plain VM, at
   any provider, the sandbox is ours to build and ADR 0031's design works unchanged. ECS Fargate,
   ADR 0034's scale plan on AWS, was not researched this pass.
6. **Not verified:**
   - Vultr's managed-database prices and Indian locations (its pricing and product pages refused
     this machine with 403 and a Cloudflare challenge);
   - Linode's object-storage price;
   - the memory price of OCI's managed PostgreSQL (not in Oracle's price list);
   - load-balancer prices on every cloud.

   Those cells say so.
7. **The Google Cloud incident feed read here starts in Feb 2026** (six incidents) [S21]. "No Middle
   East incident" means none in that window, not none ever.
8. **The self-managed operations hours in §6 are my estimate**, not a measurement from a team like
   ours.

---

## 1. Conclusions

1. **GCP Mumbai (`asia-south1`) is as fast as AWS Mumbai from Dhaka, and Delhi may be faster.**
   - TCP handshakes to regional endpoints: GCP Mumbai 44.5 ms and GCP Delhi 35.0 ms [M3]; AWS
     Mumbai 45–54 ms and AWS Hyderabad 49 ms [M2].
   - Published ping data, Dhaka to Mumbai: 42 ms; Dhaka to New Delhi: 48 ms [S60].
   - The latency argument that chose AWS in `stack-deploy.md` applies to GCP equally.
2. **At the beta's shape, GCP costs about the same as AWS, and more if 14-day PITR is kept
   literally.**
   - GCP: **≈ $164–209 a month** with Cloud SQL Enterprise (7-day PITR); **≈ $355** with Enterprise
     Plus for 14 days.
   - AWS: **≈ $158–174**, with RDS PITR up to 35 days (§4, §8).
   - Where GCP is cheaper:
     - the VM, if the N2D price holds, and full-month use gets a 20 % sustained-use discount
       automatically [S10];
     - it has a Middle East that is standing today (point 3).
   - Where GCP is worse:
     - the small database is dearer: $59 for Cloud SQL's smallest dedicated machine, against $31
       for RDS db.t4g.small;
     - that database has no SLA (§0.4);
     - traffic out to users costs about $0.12 per GB [S11]; AWS gives the first 100 GB a month free
       (`stack-deploy.md`).
3. **For the Gulf later, Google's Middle East regions are standing and AWS's are not.**
   - Google's status page shows Doha (`me-central1`), Dammam (`me-central2`) and Tel Aviv
     (`me-west1`) all "Available" on 27 Sep 2026 [S21].
   - AWS's UAE region is damaged and Bahrain is unavailable (global-markets §0).
   - Dammam is sold only through CNTXT to customers billed in Saudi Arabia. Customers billed
     elsewhere need invoiced billing to reach it [S22].
   - From Dhaka, Google's Middle East regions measured about 280 ms [M3]. That matters only to
     staff in Dhaka, not to Gulf users.
4. **The DWG sandbox works on any plain VM, on every provider.** The choice of cloud does not
   decide it.
   - On a VM we control the kernel settings: ADR 0031's `bwrap` or "locked-down sibling container"
     (`--network none --read-only`) works as designed.
   - GCP adds two managed paths for later:
     - GKE Sandbox, gVisor per pod, in Autopilot [S18];
     - Cloud Run sandboxes, which block outbound traffic and mount the filesystem read-only by
       default [S16]. **They are in Preview (pre-GA).**
5. **Cheaper and still reliable: DigitalOcean Bangalore (≈ $112–163) and Akamai/Linode Mumbai
   (≈ $109–138, object storage unverified).**
   - Both have managed Postgres 18 with PITR (DO 7 days; Akamai 14 days) and published SLAs
     [S32–S35][S40][S41].
   - What they lack next to GCP or AWS:
     - fine-grained IAM and account audit logs (not verified; neither offers an equivalent of
       CloudTrail or Cloud Audit Logs that I found);
     - cross-region copying of PITR backups (we would ship our own `pg_dump` off-region);
     - a Gulf region (DO has none; Vultr and Linode have Tel Aviv at most).
   - Linode had four minor connectivity incidents on its Mumbai or Chennai paths since April 2026
     [S42]. DO had two minor incidents in BLR1 [S37].
   - The others do not win:
     - Vultr is unverified.
     - OVHcloud's managed Postgres keeps only 2 days of backups below its 2-node "Production" plan,
       which costs about $345 [S43][S45].
     - Oracle's free tier is ARM for anything useful [S48], and its managed Postgres costs at least
       $72 per OCPU before memory [S46].
     - Hetzner Singapore has no managed Postgres and no object storage in Asia [S49].
6. **Running our own Postgres saves little at the beta's size.**
   - It saves about $15–60 a month against a managed instance (and about $190 against Cloud SQL
     Enterprise Plus).
   - It costs roughly 6–10 engineer-hours a month (estimate): restore drills, patching, upgrades,
     and on-call for the database.
   - At scale it saves perhaps $100–350 a month against Multi-AZ RDS or HA Cloud SQL (§6, §9).
   - "Our own DevOps" pays off on the app tier: containers on plain VMs with Kamal or Docker
     Compose, which ADR 0034 already chose. It does not pay off on the database.
7. **No Bangladeshi provider offers managed Postgres.** Pico Public Cloud (Kaliakair and Jashore)
   sells VMs, Kubernetes and S3-compatible object storage, and states PCI-DSS, ISO 27001 and SOC 2
   Type II. I did not verify those claims, and it lists no database service [S58]. A local cell
   today would mean running Postgres ourselves (§7).

### Recommendation

**Host the beta on GCP Mumbai if the owner accepts 7 days of PITR plus 30 days of daily backups kept
in Delhi.** Otherwise keep AWS Mumbai. In both cases:
- the database is managed;
- backups are copied to a second region from day one;
- the app is plain containers on one x86 VM.

Reasons:
- The owner already runs a GCP billing relationship.
- Latency is equal or better.
- The cost difference is small, about ±$20 a month.
- Google's Gulf regions are standing.
- The sandbox design is identical on a VM.

The ADR change this needs:
- ADR 0034's "14 days point-in-time restore" becomes "7 days of PITR, and 30 days of daily backups
  stored in a second region". A corruption found on day 10 is then restored to a daily boundary,
  not to the second.
- If 14-day PITR must hold literally, stay on AWS (RDS keeps up to 35 days for about $33). On GCP
  it costs about $190 a month more (Enterprise Plus).

**DigitalOcean Bangalore is the cheaper fallback**, about $50–80 a month less than either
hyperscaler. The owner should pick it only if cost matters more than IAM, audit logs and the Gulf
path.

The recommended GCP beta:
```
Dhaka ─HTTPS─► GCE n2d-standard-4 (4 vCPU, 16 GB, asia-south1): Caddy ─► web container
                                   └─► worker container ─► DWG readers in a sibling container
                                        (--network none, --read-only, non-root; optional gVisor runsc)
               Cloud SQL for PostgreSQL, Enterprise, 1 vCPU / 3.75 GB, zonal, PITR 7 days,
                 automated backups kept 30 days in a custom location: asia-south2 (Delhi)
               Cloud Storage bucket in the configurable dual-region IN (Mumbai + Delhi), versioned
               staging: e2-medium + Cloud SQL db-f1-micro
               Secret Manager; Artifact Registry; CI via GitHub OIDC (Workload Identity Federation)
```

---

## 2. Comparison table

| | Beta $/month (the shape above) | Scale $/month (Bangladesh) | Latency from Dhaka | Managed Postgres and PITR | The DWG sandbox | Second-region backup | Our operations burden | Lock-in |
|---|---|---|---|---|---|---|---|---|
| **GCP Mumbai** | **≈ 164–209** (≈ 355 with 14-day PITR) | ≈ 760–1,050 (estimate; ≈ 970–1,255 with Enterprise Plus HA) | 44.5 ms TCP, regional endpoint [M3]; 79 ms via Cloud Run [M1] | Cloud SQL PG 16–18. PITR 7 days (Enterprise) or 35 (Enterprise Plus). No SLA if zonal [S4–S8] | VM: yes. GKE Autopilot: GKE Sandbox pod. Cloud Run: sandboxes (Preview) [S15–S18] | Built in: Cloud SQL backups to a custom region; dual-region bucket IN [S4][S12] | Low (managed DB) | Low for VM, Postgres and objects; medium if Cloud Run or GKE |
| **GCP Delhi** | Same compute as Mumbai for E2; N2D about 1.8× Mumbai [S1] | — | 35.0 ms TCP [M3] | Same | Same | Mumbai as the pair | Low | Low |
| **AWS Mumbai** | **≈ 158–174** (ADR says 87–123 for ARM, 2 vCPU) | ≈ 860–1,110 (`stack-deploy.md`) | 45–54 ms TCP; 48 ms HTTP [M2] | RDS PG, PITR up to 35 days; Single-AZ SLA 99.5 % [S29][S30] | VM: yes. Fargate: not researched | Built in: RDS cross-Region automated backups with transaction logs; S3 replication [S29] | Low | Low |
| **DigitalOcean BLR1** | **≈ 112–163** | ≈ 450–810 (estimate) | 52–65 ms (Spaces endpoint) [M2] | PG 14–18, PITR 7 days; 99.5 % single node, 99.95 % with standby [S32–S35] | VM: yes | Do-it-ourselves: `pg_dump` to SGP1 Spaces; RPO 24 h off-region | Low to medium | Low |
| **Akamai/Linode Mumbai** | ≈ 109–138 (object storage price unverified) | not estimated | 44 ms TCP [M2] | PG 15–18; daily backups kept 14 days with PITR [S40][S41] | VM: yes | Do-it-ourselves; object storage only in Chennai or Singapore [S40] | Low to medium | Low |
| **Vultr Mumbai** | compute 60–100; DB and objects unverified | not estimated | 44 ms TCP [M2] | PITR 2 days (Startup), 14 (Business), 30 (Premium); prices unverified [S39] | VM: yes | Object storage in Bangalore and Delhi, not Mumbai [S38] | Low to medium | Low |
| **OVHcloud Mumbai** | ≈ 209 (2-day backups) or ≈ 495 (14 days) | not estimated | 46 ms TCP [M2] | PG 14–18; retention 2, 14 or 30 days by plan [S43] | VM: yes | Built in, off-site; the default copy for Mumbai goes to Canada [S44] | Low | Low |
| **Oracle (OCI) Mumbai** | ≈ 175–250 (+ PG memory, unknown) | not estimated | 58 ms TCP (min 40) [M2] | OCI PG 14–17; PITR by policy; backups 35 days, cross-region copy [S47] | VM: yes | Built in [S47] | Low to medium | Medium (fewer tools) |
| **Hetzner Singapore, self-run** | ≈ 126 | not estimated | 64 ms TCP [M2] | None managed; objects only in Europe [S49] | VM: yes | Ours: pgBackRest to R2 or Hetzner EU | **High** | Low |
| **Self-run Postgres on any VM** | saves ≈ 15–60 against managed | saves ≈ 100–350 against Multi-AZ | provider's | Ours: pgBackRest or WAL-G PITR, Patroni for HA [S51][S53] | VM: yes | Ours: a second repository in another provider | **High** (≈ 6–10 h a month, estimate) | Lowest |
| **Bangladesh (Pico Public Cloud)** | VMs from BDT 2,700; no DB service | — | not measured | None offered [S58] | VM: presumably | — | High | Low |

---

## 3. GCP in detail

### 3.1 Regions and latency

- **India.** `asia-south1` (Mumbai) and `asia-south2` (Delhi) each have three zones. Mumbai offers
  E2, N2D, N4D and C3D machines; Delhi offers E2 and N2D, but not C3D or N4D [S23].
- **Measured from Dhaka** (27 Sep 2026, median of 10–11 samples):

| Target | TCP handshake to the regional endpoint [M3] | Warm HTTP round trip via Cloud Run and Google's front end [M1] |
|---|---|---|
| GCP `asia-south2` Delhi | **35.0 ms** (min 28.6) | 79.6 ms |
| GCP `asia-south1` Mumbai | **44.5 ms** (min 43.0) | 79.0–83.5 ms |
| GCP `asia-southeast1` Singapore | 62.7 ms | 83.4–87.7 ms |
| GCP `me-central1` Doha / `me-central2` Dammam | 285 / 280 ms | 462–472 ms |
| AWS `ap-south-1` Mumbai (for comparison) | 45.0–53.6 ms [M2] | 48.4 ms (DynamoDB `/ping`) [M2] |
| Published, Dhaka → Mumbai / New Delhi / Chennai / Singapore / Doha | 42 / 48 / 40–43 / 47.5 / 114 ms average ping [S60] | — |

- **What it means.**
  - Mumbai and Delhi are both as close as AWS Mumbai.
  - The Cloud Run path adds about 35 ms, because requests go through Google's front end.
  - A Compute Engine VM with an external IP answers directly (my inference). Measure it from a VM
    before deciding.
  - Google's path from this ISP to its Middle East regions is long: 280 ms, against 114 ms of
    published Dhaka–Doha ping and 158 ms to AWS UAE [M2].
- **India incident, 2026.** From 5 to 26 June, "network traffic to Google Cloud originating from
  Delhi, Chennai, Mumbai and surrounding areas" had intermittent latency and packet loss.
  - The cause: a fire at a third-party facility isolated Google's Delhi point of presence [S21].
  - Traffic from Dhaka may enter Google in India, so incidents like this reach us too (inference).

### 3.2 The Middle East regions in 2026

- **Status.** On 27 Sep 2026 Google's regional status page showed every product in `me-central1`
  (Doha), `me-central2` (Dammam) and `me-west1` (Tel Aviv) as "Available" [S21]. The incident feed,
  which goes back to Feb 2026, has no Middle East incident [S21].
- **Contrast with AWS.** AWS's UAE region is damaged and its Bahrain region is unavailable
  (global-markets §0).
- **Access to Dammam** [S22]:
  - A customer with a Saudi billing address must buy all Google Cloud through CNTXT, the exclusive
    reseller.
  - A customer billed elsewhere reaches Dammam only with invoiced billing, not a card.
- **What follows.** For the Gulf cell (ADR 0034, global-markets item 13), Doha and Dammam are
  standing candidates. Measure them from the Gulf, not from Dhaka.

### 3.3 Compute Engine prices (x86)

Mumbai, from Google's pricing page with the region set to Mumbai [S1]. Columns: on demand / Compute
Flexible CUD 1 year / Flexible 3 years / Resource CUD 1 year / Resource 3 years, in $ per hour.

| Machine | vCPU / RAM | On demand | Flex 1y | Flex 3y | Resource 1y | Resource 3y | $/month on demand |
|---|---|---|---|---|---|---|---|
| e2-small | 2 shared / 2 GB | 0.02012 | 0.01449 | 0.01087 | 0.01268 | 0.00905 | 14.69 |
| e2-medium | 2 shared / 4 GB | 0.04024 | 0.02897 | 0.02173 | 0.02535 | 0.01811 | 29.38 |
| e2-standard-4 | 4 / 16 GB | 0.16097 | 0.11590 | 0.08692 | 0.10141 | 0.07244 | 117.51 |
| **n2d-standard-4** | 4 / 16 GB | **0.11153** | 0.08030 | 0.06023 | 0.07027 | 0.05019 | **81.42** (65.13 with full-month SUD) |
| n2d-standard-2 | 2 / 8 GB | 0.05577 | 0.04015 | 0.03011 | 0.03513 | 0.02510 | 40.71 |
| n2d-highcpu-4 | 4 / 4 GB | 0.08234 | 0.05928 | 0.04446 | 0.05187 | 0.03705 | 60.11 |
| n4d-standard-4 | 4 / 16 GB | 0.12882 | — | — | — | — | 94.04 |
| c3d-standard-4 | 4 / 16 GB | 0.18886 | 0.13598 | 0.10198 | 0.11898 | 0.08498 | 137.87 |
| n4-standard-4 (Intel) | 4 / 16 GB | 0.18866 | — | — | — | — | 137.72 |

- **Delhi.** E2 costs the same as in Mumbai. n2d-standard-4 is $0.202968 an hour and c3d-standard-4
  $0.18887 [S1].
- **The N2D anomaly.** The SKU catalogue lists N2D in Mumbai at $0.018151 per core-hour and $0.002433
  per GB-hour, against $0.027502 per core-hour in the Americas [S2]. See §0.3.
- **Sustained-use discounts (SUDs).**
  - N2 and N2D get up to 20 % off for a full month, automatically [S10].
  - E2, N4, N4D and C3D get none (they are not in the eligible list [S10]).
  - **SUDs apply only to self-serve (online) billing accounts** [S10]. If the owner's account is
    invoiced, check this.
- **Committed-use discounts (CUDs).** From the table: a 1-year flexible CUD is about 28 % off and a
  3-year one about 46 %. Resource CUDs give about 37 % and 55 %. At the beta's size the saving is
  $6–45 a month. Commit only after the worker's real load is measured (ADR 0031 §7).
- **Extras** [S2][S13]:
  - balanced persistent disk: $0.12 per GB-month in Mumbai;
  - an external IPv4 address on a standard VM: $0.005 an hour ($3.65 a month).
- **SLA.** A single VM is covered at 99.9 %, and instances in several zones at 99.99 % [S9]. EC2's
  single-instance SLA is 99.5 % [S30].

### 3.4 Cloud SQL for PostgreSQL

**Versions** [S6]:
- PostgreSQL 18 is the default (18.6), with 17.11 and 16.15.
- 16's extended support starts 1 Feb 2029.
- Aside: global-markets item 10 found that Django 6.1's `UUID7()` database function needs
  PostgreSQL 18. Every managed provider here now offers 18 except OCI: RDS lists 18.6 [S61], and
  Vultr says "up to the most recent stable release" [S39]. That is a separate question for ADR 0034,
  which says 16.

**PITR and backups** [S4][S5]:
- Transaction logs are kept 1–7 days on Enterprise (default 7) and 1–35 days on Enterprise Plus
  (default 14).
- Automated backups are kept 1–365 days (defaults 7 and 15).
- Standard backups support multi-region and custom locations, and "cross-region backup and
  restore".
- Enhanced backups go to a backup vault in the Backup and DR service. They can survive deletion of
  the instance and even of the project [S4].

**Machines.**
- Enterprise Plus comes only on N2, C4 or C4A. The smallest is db-perf-optimized-N-2 (2 vCPU,
  16 GB) [S7].
- Enterprise runs on shared-core or dedicated machines [S7].

**Mumbai prices** [S3]:

| Item | $/hour | $/month |
|---|---|---|
| Enterprise vCPU / memory | 0.0496 / 0.0084 per GB | — |
| → db-custom-1-3840 (1 vCPU, 3.75 GB) | 0.0811 | **59.20** |
| → db-custom-2-7680 (2 vCPU, 7.5 GB) | 0.1622 | 118.41 |
| Enterprise HA vCPU / memory | 0.0991 / 0.0168 | ×2 |
| Enterprise Plus N2 vCPU / memory | 0.0644 / 0.0109 | — |
| → db-perf-optimized-N-2 (2 vCPU, 16 GB) | 0.3032 | **221.34** (HA 442.82) |
| db-f1-micro / db-g1-small (shared core; no SLA) | 0.0126 / 0.042 | 9.20 / 30.66 |
| SSD storage / HA SSD / backups | per GB-hour 0.000279452 / 0.000558904 / 0.000131507 | $0.204 / $0.408 / $0.096 per GB |
| CUDs | 1 year 25 % off, 3 years 52 % off vCPU and memory; not on storage or shared-core machines | — |

**SLA** [S8]:
- 99.95 % for Enterprise with HA; 99.99 % for Enterprise Plus with HA.
- "Shared-core Instances, single-zone Instances, and read pools with 1 node are excluded."

**AlloyDB** was not researched. At our size it is not relevant: Cloud SQL already covers
Postgres 16–18, and AlloyDB is a larger, dearer engine (Low; not checked).

### 3.5 Cloud Storage, network and the second region

- **Standard storage in Mumbai:** $0.020 per GB-month. Nearline $0.016, Coldline $0.006, Archive
  $0.0025 [S11].
- **Dual-region:** $0.0253. The **configurable dual-region `IN` pairs Mumbai and Delhi** [S11][S12].
- **Traffic out:** internet egress to Asia costs $0.12 per GB up to 10 TiB [S11]. I did not fetch
  Compute Engine's Premium Tier table for Mumbai; the Cloud Storage rate is used here.
- **Second-region backups on GCP.** Use the `IN` dual-region bucket (or a Delhi bucket kept in sync
  by Storage Transfer Service [S12]), and Cloud SQL backups in a custom location, `asia-south2`
  [S4].
- **Transaction logs stay with the instance** [S4], so a Mumbai-region loss restores to the last
  daily backup, not to the minute (inference from S4).
- **AWS does better here:** RDS copies both snapshots and transaction logs to another region [S29].

### 3.6 Cloud Run, GKE Autopilot or a VM, and the DWG sandbox

ADR 0031 §8 asks that the DWG readers run "with no network and a read-only filesystem, via `bwrap`
natively in development and a locked-down sibling container in the beta".

**What `bwrap` needs.**
- Unprivileged user namespaces; its setuid mode has been removed [S57].
- Docker's default seccomp profile blocks `unshare` and namespace flags on `clone` unless the
  container has `CAP_SYS_ADMIN`. It makes an exception for a new *user* namespace [S56].

**On each platform:**

| Platform | What the docs say | `bwrap` inside? | The sandbox that fits |
|---|---|---|---|
| **Compute Engine VM** (or any VM elsewhere) | We control the host | Yes, if the host allows unprivileged user namespaces. Ubuntu's AppArmor restriction is to be tested in M0 (unverified here) | ADR 0031's sibling container: `docker run --network none --read-only --cap-drop ALL --security-opt no-new-privileges`, non-root, memory and CPU limits. Optionally the gVisor `runsc` runtime (Apache-2.0 [S55]) for a second kernel boundary |
| **Cloud Run, gen 1** | "based on gVisor … emulation of most, but not all operating system calls" [S15] | Unknown; do not rely on it | — |
| **Cloud Run, gen 2** | A microVM with "full Linux compatibility, including support for all system calls, namespaces, and cgroups". Jobs and worker pools run only on gen 2 [S15] | Plausible, unmeasured | **Cloud Run sandboxes** (Preview): the `sandbox do` command runs untrusted code with outbound traffic blocked by default and a read-only view of the container's filesystem. Sandboxes see no environment variables, secrets or metadata server [S16]. Exactly our requirement, but pre-GA terms |
| **GKE Autopilot** | No privileged containers. Baseline capabilities only. RuntimeDefault seccomp (can be set to Unconfined per workload). AppArmor `docker-default` applied [S17] | Unlikely (inference from S17 and S56) | **GKE Sandbox** (gVisor) per pod, which Google calls a good fit for "applications processing external media or data using CPUs". Add a NetworkPolicy that blocks egress and the metadata server, and a read-only root filesystem [S18] |

**Cost of Cloud Run for steady CAD work.** In Mumbai it costs $0.000018 per vCPU-second and
$0.000002 per GB-second [S14], which is $47.30 per always-on vCPU-month.
- An N2D vCPU costs $13.25 a month [S2], so Cloud Run is about 3.6× that.
- AWS Fargate ARM costs $17.40 (`stack-deploy.md`), so Cloud Run is about 2.7× that.
- So: VMs for the worker. Cloud Run only for a web tier that can scale to zero, if ever.

**GKE.** The free tier gives $74.40 of credit per billing account per month, which covers one
Autopilot or zonal cluster's management fee. The SLA is 99.95 % for the Autopilot control plane and
99.9 % for Autopilot pods across zones [S19]. ADR 0034 rejects Kubernetes for the beta; this does
not change that.

### 3.7 Secrets, images and logs

- **Secret Manager:** the first 6 active secret versions are free [S20].
- **Artifact Registry:** 0.5 GB free, then $0.10 per GB-month [S20].
- **Cloud Logging:** $0.50 per GB ingested, after 50 GB per project per month free, including 30
  days of storage [S20].
- **Totals at the beta's size:** under $1 a month.
- **CI without stored keys:** GitHub OIDC works with GCP (`stack-deploy.md`).

### 3.8 Data-processing terms

- **Google's Cloud Data Processing Addendum** is part of the Google Cloud agreement. It has a
  "Restricted Transfers" section for transfers out of the EMEA region [S25].
- **For Bangladesh's PDP Act** (s.29(3), `stack-deploy.md` §2), the client terms name Google Cloud,
  `asia-south1`/`asia-south2`, as a subprocessor. That is the same duty as naming AWS Mumbai.
- **Not advice.** Counsel checks it (ADR 0034).

### 3.9 What an existing GCP account or credits cover

General facts only; the owner knows the account.
- **Free Trial.** $300 over 90 days, for new customers only [S24].
- **Google for Startups** [S24]:
  - The Start tier gives up to $2,000 for a year. It is aimed at startups with an MVP that plan to
    seek venture funding.
  - The Scale tier gives up to $200,000 ($350,000 for AI startups), for VC-funded startups.
  - Eligibility: founded within 5 years, and "not yet received more than $5,000 in Google Cloud
    credits".
- **AWS's equivalent.** Activate Founders gives $1,000, rising to $5,000, for self-funded startups
  [S31].
- **Free every month on any billing account:**
  - one GKE cluster's fee [S19];
  - Cloud Run's first 240,000 vCPU-seconds and 450,000 GB-seconds [S14];
  - 50 GB of logs [S20].
- **SUDs** need a self-serve billing account [S10]; **Dammam** needs invoiced billing [S22].

---

## 4. AWS Mumbai, refreshed

**Prices are unchanged since `stack-deploy.md`.**
- EC2: price file published 25 Sep 2026 17:45 UTC [S27].
- RDS: published 24 Sep 2026 21:10 UTC [S28].
- RDS PG db.t4g.micro/small/medium are still $0.021/$0.042/$0.084 an hour; db.m7g.large is $0.24
  (Multi-AZ $0.479).

**x86 instances in Mumbai** (Linux, on demand) [S27]:

| Instance | vCPU / RAM | $/hour | $/month |
|---|---|---|---|
| t3a.medium | 2 burst / 4 GB | 0.0246 | 17.96 |
| t3a.xlarge | 4 burst / 16 GB | 0.0986 | 71.98 |
| c6a.xlarge | 4 / 8 GB | 0.0935 | 68.26 |
| m6a.large | 2 / 8 GB | 0.05555 | 40.55 |
| m6a.xlarge | 4 / 16 GB | 0.1111 | 81.10 |
| m7i.xlarge | 4 / 16 GB | 0.2121 | 154.83 |

**Cross-region backups.** RDS "cross-Region automated backup replication" copies snapshots and
transaction logs to another region as soon as they are ready. It is supported for RDS for
PostgreSQL, including Multi-AZ DB instances. Snapshot-copy transfer and destination storage are
charged [S29].

**SLAs** [S30]:
- EC2: 99.5 % for a single instance; 99.99 % across two or more AZs.
- RDS: 99.5 % for a single DB instance; 99.95 % Multi-AZ.

**The Gulf.** AWS's UAE and Bahrain regions are out (global-markets §0), and its Saudi region is
due in December 2026.

---

## 5. The cheaper providers

### 5.1 DigitalOcean (BLR1 Bangalore, SGP1 Singapore)

- **Products.** BLR1 and SGP1 both carry Droplets, Spaces, Managed PostgreSQL, Kubernetes, App
  Platform, load balancers, VPC and backups [S35].
- **Compute** [S36]:
  - Basic, 4 vCPU and 8 GiB: $48 (5,000 GiB of transfer included).
  - CPU-Optimized, 4 dedicated vCPU and 8 GiB: $84.
  - General Purpose, 4 vCPU and 16 GiB: $126.
- **Managed Postgres, prices** [S33][S35]:
  - A single node starts at $15 (1 GiB). HA starts at $30 plus a $30 standby.
  - Standard edition runs PostgreSQL 14–18; Advanced Edition runs 16–18 and defaults to 18.
- **Managed Postgres, backups and SLA** [S32][S34]:
  - "Daily point-in-time backups … restore to any point-in-time within the previous seven days."
  - SLA: 99.95 % with a standby node, 99.5 % without.
- **Incidents since 22 Apr 2026** (the status page's last 50) [S37]:
  - 19 Jul, minor: block storage in five regions including BLR1 and SGP1.
  - 19 Jul, minor: networking in BLR1.
- **What it lacks for us:**
  - a way to archive its PITR logs to another region (we would add a nightly `pg_dump` to SGP1
    Spaces or R2, which is a 24-hour off-region RPO);
  - a Gulf region;
  - an account audit trail and IAM as fine-grained as GCP's or AWS's (not verified in this pass).

### 5.2 Vultr (Mumbai `bom`, Bangalore `blr`, Delhi `del`, Singapore `sgp`)

- **Compute, from the public API** [S38]:
  - vc2-4c-8gb $40 (not in Delhi);
  - vhp-4c-8gb (AMD or Intel) $48;
  - voc-c-4c-8gb, CPU-optimized with dedicated cores, $80;
  - vc2-2c-4gb $20.
- **Object storage** is in Bangalore, Delhi and Singapore, **not Mumbai** [S38].
- **Managed Postgres** [S39]:
  - PostgreSQL 14 up to the latest.
  - PITR by plan: Premium 30 days, Business 14, Startup 2, Hobbyist none.
- **Unverified:** database prices and which Indian regions host databases (§0.6).

### 5.3 Akamai / Linode (Mumbai `ap-west` and `in-bom-2`, Chennai `in-maa`, Singapore `sg-sin-2`)

- **Where things are, from the public API** [S40]:
  - Managed Databases are in all four.
  - Object storage is in Chennai and Singapore 2, **not Mumbai**.
  - VPC is in `in-bom-2`, not `ap-west`.
- **Postgres versions:** 15, 16, 17 and 18 [S40].
- **Database prices** [S40]:
  - 1 GB: $16 (one node) or $37 (three nodes).
  - 2 GB: $32 or $74.
  - Dedicated 2 vCPU / 4 GB: $68, $143 (two nodes) or $206 (three).
- **Compute** [S40]: 4 vCPU / 8 GB costs $48 shared or $72 dedicated. There is no Indian price
  premium.
- **Backups:** "daily backups … retained for 14 days. You can perform a point in time recovery for
  each day over the last 14 days" [S41]. The page is titled "Aiven database clusters"; I infer the
  service runs on Aiven.
- **Incidents since 24 Apr 2026** [S42]:
  - 12 May: connectivity, Mumbai and Chennai.
  - 28 Apr: connectivity, Chennai.
  - 31 Jul: upstream loss, Chennai/Mumbai 2 to the US.
  - 6 Jul: managed databases in all regions.

### 5.4 OVHcloud (Mumbai, `AP-SOUTH-MUM`)

- **Managed Postgres:** PostgreSQL 14–18, "available in all Public Cloud 1-AZ and 3-AZ regions"
  [S43].
- **Backup retention by plan** [S43]:
  - Essential/Discovery (1 node): 2 days.
  - Business/Production (2 nodes): 14 days.
  - Enterprise/Advanced (3 nodes): 30 days.
- **Off-site backups are continuous** [S44].
  - The **default off-site copy for Mumbai goes to Beauharnois, Canada**. It can be set to another
    region, which matters for the client terms.
- **Prices** (India site, INR, excluding VAT) [S45]:
  - compute b3-16 (4 vCore, 16 GB) ₹7,577 ≈ $79;
  - compute c3-8 (4 vCore, 8 GB) ₹6,760 ≈ $70.5;
  - compute d2-8 (4 vCPU, 8 GB, a "Discovery" test shape) ₹2,089 ≈ $22;
  - Postgres Discovery B3-4 (1 vCore, 4 GB) ₹5,607 ≈ $58.5;
  - Postgres Production B3-8 (2 nodes) ₹33,020 ≈ $345;
  - Standard object storage ₹0.598 ≈ $0.006 per GB-month;
  - in Asia-Pacific regions, 1 TB a month of outbound traffic is included per project.
- **Verdict:** cheap VMs and storage; managed Postgres with 14 days of backups is expensive.

### 5.5 Oracle Cloud (Mumbai `ap-mumbai-1`, Hyderabad `ap-hyderabad-1`)

- **Regions:** one availability domain each [S47].
- **Prices, from Oracle's price-list API** (updated 23 Sep 2026) [S46]:
  - E5/E6 x86: $0.03 per OCPU-hour (1 OCPU = 2 vCPU) and $0.002 per GB-hour. So 4 vCPU and 16 GB
    costs $67.16.
  - Block volume $0.0255 per GB-month.
  - Object storage: 10 GB free, then $0.0255.
  - **Outbound traffic from APAC: the first 10 TB a month free.**
  - Database with PostgreSQL: $0.098 per OCPU-hour and $0.072 per GB of storage. **No memory SKU
    appeared.**
- **Managed Postgres features** [S47]:
  - automated backups kept up to 35 days, copyable to another region;
  - PITR through a management policy (Oracle's example: a 10-day window);
  - versions 14–17, read through a search summary of Oracle's docs (Medium).
- **The free tier does not host an x86 beta** [S48]:
  - two AMD micro VMs, plus 1,500 OCPU-hours and 9,000 GB-hours a month of **ARM** (Ampere A1),
    i.e. 2 OCPUs and 12 GB;
  - in the home region only, with "out of host capacity" errors possible;
  - accounts idle for 30 days may be suspended.

### 5.6 Hetzner Singapore and others

- **Hetzner Singapore:**
  - no managed Postgres;
  - object storage only in Falkenstein, Nuremberg and Helsinki [S49];
  - prices rose on 15 Jun 2026 (CPX32, 4 vCPU and 8 GB, $57.99; `stack-deploy.md`).
- **UpCloud and Azure:** not researched in this pass.

---

## 6. Running it ourselves ("customizable options if we maintain DevOps ourselves")

### 6.1 Tools

- **App tier** (already ADR 0034's plan):
  - **Kamal** 2.12 (MIT) deploys Docker containers "from bare metal to cloud VMs" with
    zero-downtime deploys [S54][S55].
  - **Docker Compose** does the same more simply, without the zero-downtime part.
  - **Coolify** (Apache-2.0) is a self-hosted PaaS, a Heroku-like panel on our own VM [S55].
  - **k3s** (Apache-2.0) is lightweight Kubernetes [S55]. It is rejected for the beta by ADR 0034's
    "no Kubernetes".
- **Postgres on our own VMs:**
  - **pgBackRest** keeps backups and WAL in S3-, Azure- or GCS-compatible stores, encrypts them,
    and can keep **multiple repositories**: a short local one and a long remote one in another
    provider. Object versioning and locking guard against tampering [S51].
  - **WAL-G** does the same job; its GitHub licence reads NOASSERTION [S55].
  - **Patroni** 4.1.5 (MIT) gives automatic failover. It needs etcd, Consul, ZooKeeper or
    Kubernetes as its consensus store [S53][S55].
- **Monitoring:** node and Postgres exporters into Grafana Cloud's free tier (`stack-deploy.md`),
  plus Sentry and Logfire as now.

### 6.2 The honest burden for a team of two to five

**What the maintainers publish.** PostgreSQL ships a minor release "at least once every three
months" and supports each major version for 5 years [S52]. Each minor release is a restart; each
major release is a planned upgrade.

**Tasks we would own if we ran Postgres ourselves** (hours are my estimate, Low):

| Task | How often | Hours |
|---|---|---|
| Restore drill (already required by ADR 0034 for managed too) | monthly | 2–4 |
| OS security patches and reboots | monthly | 1–2 |
| Postgres minor upgrade | quarterly | ≈ 2 |
| Postgres major upgrade | yearly | 1–2 days |
| Backup and replication alerts, disk growth, vacuum health | ongoing | ≈ 1–2 a month |
| Patroni/etcd failover testing (at scale only) | quarterly | ≈ 4 |
| On-call when the database, not the app, breaks | at night | — |

That comes to **about 6–10 hours a month**, plus the risk that the one person who knows it is
away.

**What it saves** (§8, §9):
- At the beta: about $15–60 a month against a managed instance; about $190 against Cloud SQL
  Enterprise Plus.
- At scale: about $100–350 a month against Multi-AZ RDS ($376) or HA Cloud SQL ($287–493).
  - Three Patroni VMs cost about $120–200 plus backup storage.
  - Against DO's HA Postgres there is almost no saving.

**Verdict.** Run the app ourselves; buy the database. Revisit only if a measured scale bill makes
$200–350 a month matter more than 6–10 hours of senior time and the on-call risk.

---

## 7. Bangladesh data centres

- **Pico Public Cloud** [S58]:
  - Regions: Kaliakair and Jashore.
  - Its claims, unverified: certified Tier-III data centres, 99.99 % uptime, PCI-DSS, ISO 27001,
    SOC 2 Type II.
  - It sells VMs from BDT 2,700 a month, Kubernetes, and Ceph-based S3-compatible object storage
    (NVMe tier BDT 11 per GB-month).
  - **Its products page lists no database service.**
- **Others:** BDCOLO sells Tier III colocation, VPS and cloud hosting with a stated 99.9 % [S59];
  XeonBD sells VPSs (`stack-deploy.md`).
- **Verdict.** None I found offers managed Postgres with PITR at a credible, verifiable standard.
  - If a regulation (PDP Act s.29(4)) or a client ever requires data in Bangladesh, the path is
    Pico-style VMs with self-run Postgres (§6) as a separate cell (global-markets item 12).
  - Price that when it happens.

---

## 8. Beta cost sheets (USD a month; the shape in the header)

**GCP Mumbai** (≈ $164–209; ≈ $355 with 14-day PITR):
- VM n2d-standard-4 with SUD: 65.13 (81.42 without SUD; 117.51 if E2 has to be used).
- 30 GB balanced disk 3.60; IPv4 3.65.
- Staging: e2-medium 29.38 + 20 GB 2.40 + IPv4 3.65 = 35.43.
- Cloud SQL Enterprise db-custom-1-3840: 59.20 + 20 GB SSD 4.08 + ≈ 20 GB of backups 1.92 = 65.20.
  Backups are stored in Delhi (custom location); I assume the same backup rate.
  - Cheaper, with no SLA: db-g1-small at 36.66.
  - 14 days: Enterprise Plus N-2 at 227.34.
- Staging DB db-f1-micro: 9.20 + 10 GB 2.04 = 11.24.
- Cloud Storage: 100 GB dual-region `IN` 2.53 (replication charges not fetched).
- Egress: 50 GB × 0.12 = 6.00. Artifact Registry ≈ 0.15. Logging and Secret Manager ≈ 0.
- **Total ≈ 193**. With db-g1-small ≈ 164; without SUD ≈ 209; with Enterprise Plus ≈ 355.

**AWS Mumbai** (≈ $158–174):
- VM m6a.xlarge 81.10 (or c6a.xlarge 68.26); gp3 30 GB 2.74; IPv4 3.65.
- Staging: t3a.medium 17.96 + 20 GB 1.82 + IPv4 3.65 = 23.43.
- RDS db.t4g.small 30.66 + 20 GB 2.62 = 33.28 (PITR 14 days; 99.5 % SLA).
- Staging RDS db.t4g.micro: 15.33 + 2.62 = 17.95.
- S3: 100 GB 2.50; replication to Hyderabad ≈ 3 (estimate).
- RDS cross-Region backups ≈ 3–6 (estimate).
- Egress within the 100 GB free.
- **Total ≈ 171–174** with m6a; **≈ 158–161** with c6a.

**DigitalOcean BLR1** (≈ $112–163):
- Droplet Basic 4 vCPU / 8 GiB 48 (CPU-Optimized 84).
- Staging 4 GiB 24.
- Postgres single node 1 GiB 15 (2 GiB 30).
- Staging DB 15.
- Spaces BLR1 5; a second copy in SGP1 5.
- Transfer included.
- **Total ≈ 112** (48 + 24 + 15 + 15 + 10); up to ≈ 163 with dedicated CPU and a 2 GiB database.

**Akamai/Linode Mumbai** (≈ $109–138):
- 4 vCPU / 8 GB 48 (dedicated 72); staging 2 vCPU / 4 GB 24.
- Postgres 1 GB 16; staging DB 16.
- Object storage in Chennai ≈ 5, unverified; a second copy in Singapore ≈ 5, unverified.
- **Total ≈ 114–138.**

**OVHcloud Mumbai:**
- b3-16 79.1 + staging d2-4 (₹1,161) 12.1 + Postgres Discovery ×2 117 + objects 0.6 = **≈ 209**,
  with 2-day backups.
- With Production for 14 days: **≈ 495**.
- With self-run Postgres on a b3-8 (₹3,796 ≈ 39.6): ≈ 132.

**Oracle Mumbai:**
- 2 OCPU / 16 GB 67.16 + 50 GB 1.28; staging 1 OCPU / 4 GB 29.0.
- Postgres 1 OCPU 71.54 + 50 GB 3.60.
- Staging DB: another ≈ 75, or self-run on the staging VM.
- Objects 2.30. Egress free.
- **Total ≈ 175–250**, plus the unknown Postgres memory charge.

**Hetzner Singapore, self-run:**
- CPX32 58 + database VM CPX22 31 + staging CPX22 31 + R2 objects ≈ 1.35 + backups to R2 ≈ 5.
- **Total ≈ 126.**

## 9. Scale (Bangladesh; estimates, same load as `stack-deploy.md` §6)

- **AWS:** ≈ $860–1,110 (`stack-deploy.md`; Fargate ARM, Multi-AZ RDS m7g.large).
- **GCP, VMs in managed instance groups:**
  - web 2 × n2d-standard-2 with SUD 65;
  - workers averaging one n2d-standard-4 with SUD, 65–130;
  - regional load balancer 20–40 (not fetched);
  - Cloud SQL Enterprise HA 2 vCPU / 7.5 GB 236.67 + 100 GB HA SSD 40.80 + backups 9.60 = 287;
  - 500 GB dual-region 12.65; 1 TB egress ≈ 123;
  - observability 130–330 (`stack-deploy.md`); staging ≈ 60.
  - **Total ≈ $760–1,050**, or ≈ $970–1,255 with Enterprise Plus HA (35-day PITR, 99.99 %).
  - Cloud Run workers instead would add about $150–200 a month (§3.6).
- **DigitalOcean** (estimate):
  - web 2 × 8 GiB 96; workers 84–168; load balancer ≈ 12 (not fetched);
  - Postgres HA 60–130 (2–4 GiB primary plus standby; only the 2 GiB price is published [S33]);
  - Spaces 10; observability 130–330; staging 60.
  - **Total ≈ $450–810.**

## 10. What changes if the owner picks GCP

These are recommendations; the owner decides.

1. **ADR 0034, "Stages":**
   - Replace "AWS ap-south-1 … RDS … S3" with GCE, Cloud SQL and Cloud Storage in `asia-south1`.
   - Replace "14 days point-in-time restore" with "7 days of PITR, with 30 days of daily backups
     stored in `asia-south2`". Or keep 14 and budget Enterprise Plus.
   - Replace the "about $87–123" figure with "about $165–210".
   - Scale becomes managed instance groups of VMs with Cloud SQL HA. The Gulf gets "Doha or
     Dammam, when the Gulf opens, from regions then standing".
2. **ADR 0031 §8** is unchanged: the sibling container on the VM. Add "GKE Sandbox or Cloud Run
   sandboxes are the managed options if the worker leaves the VM."
3. **Before committing:**
   - run one e2-micro in `asia-south1` for an hour: measure latency from Dhaka, and confirm the N2D
     price in the console's estimate;
   - confirm whether the billing account is self-serve (SUDs) or invoiced.

## 11. Decisions for the owner

1. **Beta host.** Recommended: GCP Mumbai, if 7-day PITR plus 30 days of daily backups is
   acceptable. Otherwise AWS Mumbai. The cheaper alternative is DigitalOcean Bangalore.
2. **The PITR window:** 7 days (≈ $0 extra) or 14 days (+ ≈ $190 a month on GCP; free on AWS).

---

## Measurements

All from the owner's WSL2 machine in Dhaka on 27 Sep 2026. The ISP was not recorded. Raw output is
kept locally at `.private/work/session-02/digests/deploy-latency-2026-09-27.txt` (not in git).

- **[M1] Cloud Run round trip, 16:01 and 16:03 UTC.** Warm HTTP to gcping's per-region Cloud Run
  services (`https://<region>-5tkroniexa-<x>.a.run.app/api/ping`, listed at [S26]). The figure is
  `time_starttransfer − time_pretransfer` on a reused connection, 11 samples, median.
- **[M2] TCP handshakes, 16:02 UTC.** `time_connect − time_namelookup`, 10 samples, median, to:
  - AWS `ec2.<region>.amazonaws.com` (and warm HTTP to `dynamodb.<region>.amazonaws.com/ping`);
  - Vultr `*-ping.vultr.com`;
  - Linode `speedtest.<dc>.linode.com`;
  - Hetzner `sin-speed.hetzner.com`;
  - OVH `bom.proof.ovh.net`;
  - DO `blr1/sgp1.digitaloceanspaces.com` (warm HTTP);
  - OCI `objectstorage.<region>.oraclecloud.com` (16:42 UTC).
  - AWS Mumbai measured 53.6 ms at 16:02 and 45.0 ms at 16:42.
- **[M3] Google regional endpoints, 16:42 UTC.** TCP handshake and warm HTTP to
  `storage.<region>.rep.googleapis.com`, 10–11 samples.

## Sources (all read 27 Sep 2026)

- [S1] GCP general-purpose VM pricing, region set to Mumbai and to Delhi in a browser: https://cloud.google.com/products/compute/pricing/general-purpose
- [S2] GCP SKU catalogue (filters "E2 Instance Core/Ram running in Mumbai", "N2D AMD Instance running in Mumbai", "N2D AMD Instance Core running in Americas", "Balanced PD Capacity in Mumbai"): https://cloud.google.com/skus
- [S3] Cloud SQL pricing, region Mumbai: https://cloud.google.com/sql/pricing
- [S4] Cloud SQL backup options (updated 24 Sep 2026): https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backup-options ; backups overview: https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backups
- [S5] Configure PITR: https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/configure-pitr
- [S6] Cloud SQL database versions: https://docs.cloud.google.com/sql/docs/postgres/db-versions
- [S7] Cloud SQL machine series (updated 25 Sep 2026): https://docs.cloud.google.com/sql/docs/postgres/machine-series-overview
- [S8] Cloud SQL SLA: https://cloud.google.com/sql/sla
- [S9] Compute Engine SLA (single instance ≥ 99.9 %; multiple zones ≥ 99.99 %): https://cloud.google.com/compute/sla
- [S10] Sustained use discounts: https://docs.cloud.google.com/compute/docs/sustained-use-discounts
- [S11] Cloud Storage pricing, region Mumbai: https://cloud.google.com/storage/pricing
- [S12] Cloud Storage locations (updated 24 Sep 2026): https://docs.cloud.google.com/storage/docs/locations
- [S13] VPC network pricing (external IPs): https://cloud.google.com/vpc/network-pricing
- [S14] Cloud Run pricing, region Mumbai: https://cloud.google.com/run/pricing
- [S15] Cloud Run execution environments: https://docs.cloud.google.com/run/docs/about-execution-environments
- [S16] Cloud Run code execution (sandboxes, Preview): https://docs.cloud.google.com/run/docs/code-execution ; configure sandboxes for services (updated 24 Sep 2026): https://docs.cloud.google.com/run/docs/configuring/services/sandboxes
- [S17] GKE Autopilot security measures: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/autopilot-security
- [S18] GKE Sandbox: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods
- [S19] GKE pricing: https://cloud.google.com/kubernetes-engine/pricing
- [S20] Cloud Logging pricing: https://cloud.google.com/stackdriver/pricing ; Secret Manager: https://cloud.google.com/secret-manager/pricing ; Artifact Registry: https://cloud.google.com/artifact-registry/pricing
- [S21] Google Cloud status, Middle East: https://status.cloud.google.com/regional/middle-east ; incident feed: https://status.cloud.google.com/incidents.json ; India incident: https://status.cloud.google.com/incidents/5fGQt4VbkDnr3Yp8PXPr
- [S22] Dammam region access: https://docs.cloud.google.com/docs/dammam-region-access
- [S23] Compute Engine regions and zones: https://docs.cloud.google.com/compute/docs/regions-zones
- [S24] GCP Free Trial: https://docs.cloud.google.com/free/docs/free-cloud-features ; Google for Startups benefits: https://cloud.google.com/startup/benefits
- [S25] Cloud Data Processing Addendum: https://cloud.google.com/terms/data-processing-addendum
- [S26] gcping endpoint list: https://global.gcping.com/api/endpoints
- [S27] AWS EC2 Mumbai Linux on-demand price map (published 25 Sep 2026): https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/Asia%20Pacific%20(Mumbai)/Linux/index.json
- [S28] AWS RDS PostgreSQL on-demand price map (published 24 Sep 2026): https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/rds/USD/current/rds-postgresql-ondemand.json
- [S29] RDS cross-Region automated backups: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReplicateBackups.html
- [S30] RDS SLA: https://aws.amazon.com/rds/sla/ ; EC2 SLA: https://aws.amazon.com/compute/sla/
- [S31] AWS Activate credits: https://aws.amazon.com/startups/credits
- [S32] DO Managed PostgreSQL features: https://docs.digitalocean.com/products/databases/postgresql/details/features/
- [S33] DO Managed PostgreSQL pricing: https://docs.digitalocean.com/products/databases/postgresql/details/pricing/
- [S34] DO Managed PostgreSQL SLA: https://docs.digitalocean.com/products/databases/postgresql/details/sla/
- [S35] DO PostgreSQL Advanced Edition: https://docs.digitalocean.com/products/databases/postgresql/concepts/advanced-edition/ ; PG availability: https://docs.digitalocean.com/products/databases/postgresql/details/availability/ ; regional availability: https://docs.digitalocean.com/platform/regional-availability/ ; PG versions 14–18 (search summary of docs.digitalocean.com)
- [S36] DO Droplet pricing: https://www.digitalocean.com/pricing/droplets
- [S37] DO status incidents: https://status.digitalocean.com/api/v2/incidents.json
- [S38] Vultr API: https://api.vultr.com/v2/regions , https://api.vultr.com/v2/plans , https://api.vultr.com/v2/object-storage/clusters
- [S39] Vultr PostgreSQL FAQ: https://docs.vultr.com/products/managed-database/postgresql/faq ; versions (updated 15 Apr 2026): https://docs.vultr.com/support/products/managed-databases/what-postgresql-versions-are-supported-in-vultr-managed-databases
- [S40] Linode API: https://api.linode.com/v4/regions , https://api.linode.com/v4/databases/types , https://api.linode.com/v4/databases/engines , https://api.linode.com/v4/linode/types
- [S41] Akamai managed databases: https://techdocs.akamai.com/cloud-computing/docs/aiven-database-clusters
- [S42] Linode status incidents: https://status.linode.com/api/v2/incidents.json
- [S43] OVHcloud Public Cloud Databases for PostgreSQL, capabilities (updated 21 Sep 2026): https://docs.ovhcloud.com/en/guides/public-cloud/databases/postgresql-capabilities
- [S44] OVHcloud automated backups for Public Cloud Databases: https://docs.ovhcloud.com/en/guides/public-cloud/databases/backups
- [S45] OVHcloud India Public Cloud prices: https://www.ovhcloud.com/en-in/public-cloud/prices/
- [S46] Oracle Cloud price-list API (lastUpdated 23 Sep 2026): https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/?currencyCode=USD
- [S47] OCI Database with PostgreSQL backups: https://docs.oracle.com/en-us/iaas/Content/postgresql/backups.htm ; PITR: https://docs.oracle.com/en-us/iaas/Content/postgresql/point-time-recovery.htm ; regions: https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm
- [S48] OCI Always Free resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm ; https://www.oracle.com/cloud/free/
- [S49] Hetzner Object Storage overview: https://docs.hetzner.com/storage/object-storage/overview/
- [S50] ECB reference rates via Frankfurter, 25 Sep 2026: https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,EUR,SGD
- [S51] pgBackRest: https://pgbackrest.org/
- [S52] PostgreSQL versioning policy: https://www.postgresql.org/support/versioning/
- [S53] Patroni 4.1.5 documentation: https://patroni.readthedocs.io/en/latest/
- [S54] Kamal 2.12: https://kamal-deploy.org/
- [S55] GitHub API, licence and last push, for coollabsio/coolify, basecamp/kamal, wal-g/wal-g, pgbackrest/pgbackrest, patroni/patroni, k3s-io/k3s, containers/bubblewrap, google/gvisor: https://api.github.com/repos/<owner>/<repo>
- [S56] Docker seccomp security profiles: https://docs.docker.com/engine/security/seccomp/
- [S57] bubblewrap README: https://github.com/containers/bubblewrap
- [S58] Pico Public Cloud, home and products pages (read in a browser): https://picopublic.cloud/ , https://picopublic.cloud/products
- [S59] BDCOLO: https://www.bdcolo.net/
- [S61] Amazon RDS for PostgreSQL versions (lists 18.6 and a PostgreSQL 19 section): https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-versions.html
- [S60] WonderNetwork pings from Dhaka (samples dated 13 Sep 2026): https://wondernetwork.com/pings/Dhaka/Mumbai , https://wondernetwork.com/pings/Dhaka/New%20Delhi , https://wondernetwork.com/pings/Dhaka/Chennai , https://wondernetwork.com/pings/Dhaka/Singapore , https://wondernetwork.com/pings/Dhaka/Doha
