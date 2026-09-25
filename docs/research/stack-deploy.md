# Where and how Vextrus is deployed and observed: dev, beta, scale

Question: where and how should Vextrus be deployed and observed at each of three stages (dev on one
WSL2 machine; a beta with about 3 to 10 Developer clients; scale across Bangladesh and then the
Gulf)? At what monthly cost, and with what latency from Dhaka?

Researched 2026-09-25. Sources are vendor price pages and docs fetched that day, AWS's public price
list files (`pricing.us-east-1.amazonaws.com`, publication date 2026-09-24), the Vultr public plans
API, the Bangladesh law texts on bdlaws.minlaw.gov.bd, and latency measured from this machine. All
prices are USD per month, on demand, before tax, at 730 hours a month, unless stated.

Assumed shape of Vextrus (from the brief, `docs/postmortem.md` and ADRs 0011, 0013, 0017): a Python
backend, a web frontend, Postgres, CPU-heavy CAD jobs (LibreDWG 0.14 as a separate process, ezdxf,
IfcOpenShell), calls to TypeSafe's US-hosted Jev, and users in Dhaka. Docker in dev slowed the old
ERP (postmortem §6); containers at deploy time are a separate question.

---

## Bottom line

1. **Dev costs $0 and has no Docker.** It runs natively on WSL2: uv/Python, the native Postgres 16,
   and LibreDWG built from source. Claude Code cloud sessions serve as the per-task "preview
   environments". Their VM already has PostgreSQL 16, Docker, 4 vCPUs and 16 GB of RAM, and
   Anthropic makes no separate compute charge for it. GitHub Actions is free for this public repo.
   Telemetry goes out through OpenTelemetry from the first line of code: Logfire's free tier, and
   Sentry's free Developer plan for errors.
2. **Host the beta in AWS Mumbai (`ap-south-1`): one VM, RDS Postgres and S3.** It costs about
   **$87 to $123 a month**, and AWS's new-account credits cover the first months.
   - **Latency.** Mumbai is the nearest large cloud region to Dhaka: 41 to 44 ms measured and
     published, against 47 to 69 ms for Singapore.
   - **Cost.** Mumbai's EC2 prices are about half of Singapore's.
   - **Room to grow.** AWS has a region in the UAE for the Gulf later.
   - **The cheaper alternative.** DigitalOcean in Bangalore costs about the same and is simpler, but
     has less headroom.
3. **At scale, run the same container image on ECS Fargate,** with Multi-AZ RDS and workers that
   autoscale on queue depth. Expect roughly **$860 to $1,110 a month** for Bangladesh. The Gulf
   gets a separate deployment in `me-central-1` (UAE) when it opens, because Gulf data-transfer
   rules differ.
4. **Bangladesh does not currently require data to stay in the country** for a B2B SaaS like
   Vextrus. The Personal Data Protection Act 2026 dropped the 2025 Ordinance's in-country cloud
   copy. Transfers abroad need the data subject's consent or a contract with them. Regulations
   under the Act are still to come, so stay portable.
5. **The PaaS options near Dhaka are all in Singapore:** Render, Railway and Neon. They are fine for
   latency but cost more for CPU-heavy workers. Hetzner Singapore stopped being cheap after its
   15 June 2026 price rise.

---

## 1. Latency from Dhaka

| Path | Published | Measured from this machine (TCP handshake, DNS excluded, median of 10) |
|---|---|---|
| Dhaka → Mumbai | 41.3 ms avg ([WonderNetwork](https://wondernetwork.com/pings/Mumbai/Dhaka), 2026-09-25); 42 ms 24-h avg ([Zenlayer](https://www.zenlayer.com/public-latency-table-dmd/)) | AWS `ap-south-1` 44 ms; Vultr Mumbai 44 ms |
| Dhaka → Hyderabad | — | AWS `ap-south-2` 48 ms |
| Dhaka → Bangalore | — | Vultr Bangalore 57 ms |
| Dhaka → Singapore | 47.5 ms avg, 45 to 48 ms typical ([WonderNetwork](https://wondernetwork.com/pings/Dhaka/Singapore), 2026-09-25); 51 ms ([Zenlayer](https://www.zenlayer.com/public-latency-table-dmd/)) | Vultr Singapore 52 ms; AWS `ap-southeast-1` 69 ms |
| Dhaka → Dubai / UAE | 101 ms Dhaka–Dubai ([Zenlayer](https://www.zenlayer.com/public-latency-table-dmd/)) | AWS `me-central-1` 161 ms |
| Dhaka → US (Jev) | 273 ms to Los Angeles, 279 ms to Washington DC ([Zenlayer](https://www.zenlayer.com/public-latency-table-dmd/)) | AWS `us-east-1` 262 ms, `us-west-2` 270 ms |
| Mumbai / Singapore → US East | 227 ms Mumbai–IAD, 224 ms Singapore–IAD, 173 ms Singapore–LAX ([Zenlayer](https://www.zenlayer.com/public-latency-table-dmd/)) | — |

- **How I measured.** `curl` timing (`time_connect − time_namelookup`) to public regional endpoints
  (`ec2.<region>.amazonaws.com`, Vultr's `*-ping.vultr.com`), run from the owner's WSL2 machine on
  2026-09-25. The ISP was not recorded. Occasional samples above 1 s were outliers and are excluded
  by the median.
- **What it means.** Mumbai beats Singapore by about 5 to 25 ms. For a web app that difference is
  imperceptible. It matters for chatty database traffic, so **the app and its database must sit in
  the same region.**
- **Jev from a Mumbai server.** Every call to the US adds about 0.23 s of round trip.
  `docs/research/jev-system-one.md` measured 0.33 s median per warm call from this machine, of which
  about 0.25 s was the network. Keep the connection warm and batch questions.
- **Bangladesh's international links fail from time to time.**
  - The Daily Star reported a SEA-ME-WE 5 break (the undersea cable towards Singapore) that left
    100 of 1,700 Gbps. The same report says about 2,700 of the country's 5,200 Gbps of
    international bandwidth comes through terrestrial links that import it from India
    ([Daily Star](https://www.thedailystar.net/business/news/submarine-cable-breakdown-disrupts-bangladesh-internet-3591151);
    the article's date did not render in my fetch).
  - BSCPLC also scheduled SEA-ME-WE 5 maintenance for 9 to 13 April 2026
    ([Daily Star](https://www.thedailystar.net/business/news/bangladesh-face-internet-disruptions-until-evening-3663036)).
  - **Inference, not verified:** a region in India may ride the terrestrial links and stay reachable
    when the Singapore cable is down.

## 2. Law: where may the data live?

**Bangladesh.**
- **The 2025 Ordinance** (No. 61 of 2025) was promulgated 6 Nov 2025. Its s.29(7)(b) required "at
  least one synchronized real-time copy of all data stored in the cloud [to] be kept within
  Bangladesh"
  ([Ordinance text, bdlaws print, via dpo-india.com](https://dpo-india.com/Resources/Privacy_Regulations_in_Asia_Pacific_Countries/Bangladesh-Personal-Data-Protection-Ordinance,2025(Ordinance.No.61-2025).pdf)).
- **The Amendment Ordinance** (No. 23 of 2026, 5 Feb 2026) narrowed that copy to *restricted*
  personal data (s.29(1)(d)) and to Critical Information Infrastructure
  ([bdlaws, s.2](http://bdlaws.minlaw.gov.bd/act-1616/section-56668.html)).
- **The Personal Data Protection Act 2026** (Act No. 63 of 2026, 10 Apr 2026) repealed both
  ([bdlaws act-1616 notes the repeal](http://bdlaws.minlaw.gov.bd/act-1616.html);
  [Act text](http://bdlaws.minlaw.gov.bd/act-print-1692.html)). What the Act says:
  - **No in-country copy.** Its s.29 has no cloud-copy clause. Sub-section (7) is now only a power
    to make regulations.
  - **Transfers abroad** are allowed with the data subject's consent, or where the data subject is
    party to a contract for goods or services (s.29(3)).
  - **Destinations** are only "places or countries" where regulations say suitable storage
    technology exists (s.29(4)). I found no such regulation.
  - **Notification.** Large-scale transfers of NID, passport or TIN numbers, biometrics, genetic
    data or criminal records must be notified to the authority (s.29(6)).
  - **Commencement.** The Act is deemed in force from 6 Nov 2025. Sections 23 and 31 to 35 start
    on a gazetted date after 18 months (s.1(3)).
- **Other 2026 laws.**
  - The National Data Management Act 2026 ([bdlaws act-1709](http://bdlaws.minlaw.gov.bd/act-print-1709.html))
    had no storage-location clause that I could find by keyword search of its Bangla text.
    (Searched: cloud, "within", "abroad". The only "cloud" hit is a board member's expertise.)
  - Industry commentary on the March 2026 revision says it removed "data localization mandates"
    ([CCIA, Apr 2026](https://ccianet.org/wp-content/uploads/2026/04/CCIA-Views-on-Bangladeshs-Personal-Data-Protection-Ordinance.pdf)).
- **What applies to Vextrus.** User accounts (names, emails, phones) are personal data. Title
  blocks can name people too. Drawings and quantities are mostly not personal data. So hosting in
  Mumbai and calling TypeSafe in the US are lawful today, provided the client agreement and privacy
  notice take consent for, or cover by contract, the cross-border processing, and name the
  subprocessors. That is my reading of the text, not legal advice.
- **No hyperscaler is in Bangladesh.** AWS lists no Bangladeshi region
  ([AWS Regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html))
  and no Dhaka Local Zone
  ([Local Zones](https://aws.amazon.com/about-aws/global-infrastructure/localzones/locations/)).
  Local hosts sell VPSs (for example XeonBD: 4 vCPU, 6 GB for ৳4,250 a month). I saw no managed
  Postgres, object storage or published SLA ([XeonBD](https://www.xeonbd.com/vps/)).

**Gulf (for the scale stage).** Saudi Arabia's PDPL transfer regulation, updated in September 2024,
conditions transfers abroad on safeguards (SCCs, binding common rules, certification) and on risk
assessments
([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2024/10/updates-to-saudi-arabias-personal-data-protection-regulations-sccs-guidelines-and-more);
[Morgan Lewis](https://www.morganlewis.com/pubs/2024/09/saudi-arabia-personal-data-protection-law-transition-period-ends-september-14)).
These are secondary sources. Research this properly when the Gulf opens (ADR 0017). AWS has
`me-central-1` (UAE) and `me-south-1` (Bahrain)
([AWS Regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html)).

## 3. The options, priced

### Compute near Dhaka

| Provider / region | Example machine | $/month | Source |
|---|---|---|---|
| AWS EC2 Mumbai | t4g.small (2 vCPU burst, 2 GB) / t4g.medium (4 GB) / t4g.large (8 GB) | 8.18 / 16.35 / 32.70 | AWS price list: $0.0112, $0.0224, $0.0448 per hour |
| AWS EC2 Mumbai | c7g.large (2 vCPU, 4 GB) / c7g.xlarge (4 vCPU, 8 GB) | 35.84 / 71.69 | $0.0491, $0.0982 per hour |
| AWS EC2 Singapore | t4g.large / c7g.large | 61.90 / 60.81 | $0.0848, $0.0833 per hour, about 1.7 to 1.9× Mumbai |
| AWS extras | public IPv4 address; gp3 disk; T4G surplus CPU credits | 3.65; $0.0912 per GB; $0.04 per vCPU-hour | [VPC pricing](https://aws.amazon.com/vpc/pricing/); price list |
| AWS Fargate Mumbai (ARM) | per vCPU-hour / per GB-hour | $0.02383 / $0.00261 | AmazonECS price list |
| AWS Lightsail | 2 GB $12, 4 GB $24, 8 GB $44 (Mumbai gets half the transfer allowance) | 12 to 44 | [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/) |
| DigitalOcean SGP1 / BLR1 | Basic 4 GB/2 vCPU $24; 8 GB/4 vCPU $48; CPU-optimised 4 GB/2 vCPU $42 | 24 to 84 | [Droplet pricing](https://www.digitalocean.com/pricing/droplets); both regions carry Droplets, Managed PostgreSQL, Spaces, App Platform and DOKS ([availability](https://docs.digitalocean.com/platform/regional-availability/)) |
| Vultr Mumbai / Bangalore / Singapore | 2 vCPU, 4 GB: $20 (regular) or $24 (high-frequency / AMD) | 20 to 48 | Vultr public API `/v2/plans`; same price in all three |
| Hetzner Singapore | CPX22 (2 vCPU, 4 GB) €26.49 / $30.99; CPX32 (4 vCPU, 8 GB) $57.99; CCX13 (2 dedicated vCPU) $63.49; only 1 to 2 TB traffic in SIN | 31 to 64 | [Hetzner price adjustment, 15 Jun 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) (CPX22 SIN was €15.99 before); [traffic](https://www.hetzner.com/cloud/regular-performance) |
| Fly.io | performance-2x 4 GB $17.88 base. Region multiplier ×3.0 in Mumbai, ×2.0 in Singapore | about 36 to 54 | [Fly pricing](https://docs.fly.io/about/pricing/) |
| Render (Singapore; no India region) | 1 CPU/2 GB $25; 2 CPU/4 GB $85; Pro workspace $25 | 25 to 85 | [Render pricing](https://render.com/pricing); [regions](https://render.com/docs/regions) |
| Railway (Singapore; no India) | $20 per vCPU-month + $10 per GB-month of RAM; Pro $20 | usage | [plans](https://docs.railway.com/reference/pricing/plans); [regions](https://docs.railway.com/reference/deployment-regions) |
| GCP / Azure | Not priced in this pass. GCP's always-free e2-micro and 5 GB of storage are US regions only | — | [GCP free tier](https://docs.cloud.google.com/free/docs/free-cloud-features) |

### Managed Postgres with backups and PITR

| Option | Price | Backups / PITR | Source |
|---|---|---|---|
| AWS RDS Mumbai | db.t4g.micro $15.33, db.t4g.small $30.66, db.t4g.medium $61.32 (Single-AZ). Multi-AZ doubles it (t4g.small $61.32; m7g.large $349.67). gp3 storage $0.131 per GB; backups beyond the free allocation $0.095 per GB | Automated backups with PITR within a retention of 0 to 35 days (console default 7) | Price list; [retention](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.BackupRetention.html); [PITR](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html) |
| AWS RDS Singapore | db.t4g.small $37.23 | same | price list |
| DigitalOcean Managed PG (SGP1 / BLR1) | 1 GB/1 vCPU $15.15; with standby $30.30; storage $0.215 per GiB | Daily backups plus WAL, PITR within 7 days | [pricing](https://www.digitalocean.com/pricing/managed-databases); [features](https://docs.digitalocean.com/products/databases/postgresql/details/features/) |
| Lightsail DB | 1 GB $15, HA $30 | PITR not stated on the page | [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/) |
| Render Postgres (Singapore) | 1 GB $19; 2 GB $40; storage $0.30 per GB | PITR 3 days (Hobby), 7 days (Pro) | [Render pricing](https://render.com/pricing) |
| Neon (Singapore only; no Mumbai) | Free: 0.5 GB, 100 CU-hours. Launch: $0.106 per CU-hour, $0.35 per GB | Free 6 h; Launch up to 7 days; Scale 30 days. Branches per PR through GitHub Actions | [pricing](https://neon.com/pricing); [regions](https://neon.com/docs/introduction/regions); [branching actions](https://neon.com/docs/guides/branching-github-actions) |
| Supabase | Pro $25 (8 GB disk); PITR +$100 a month per 7 days | 7-day daily backups on Pro | [pricing](https://supabase.com/pricing) |
| Fly Managed Postgres | Basic $38, Starter $72; storage $0.28 per GB | Region list not checked | [Fly MPG](https://docs.fly.io/mpg/) |

### Object storage

| Option | Price | Source |
|---|---|---|
| AWS S3 Mumbai or Singapore | $0.025 per GB-month for the first 50 TB. Mumbai egress $0.1093 per GB after 100 GB a month free (aggregated globally) | AWS price lists (S3, AWSDataTransfer) |
| Cloudflare R2 | $0.015 per GB-month; egress free; free tier 10 GB, 1M class A and 10M class B operations; an `apac` location hint | [R2 pricing](https://developers.cloudflare.com/r2/pricing/); [location](https://developers.cloudflare.com/r2/reference/data-location/) |
| DigitalOcean Spaces | $5 for 250 GiB and 1 TiB of transfer | [Spaces pricing](https://www.digitalocean.com/pricing/spaces-object-storage) |

### CI, previews, secrets, observability

| Need | Option and terms | Source |
|---|---|---|
| CI | GitHub Actions standard runners are free in public repositories. Private repos on the Free plan get 2,000 minutes, then $0.006 per Linux minute | [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| Container registry | GHCR is free for public packages. Private packages on Free get 500 MB and 1 GB of transfer | [Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages) |
| Cloud credentials in CI | GitHub OIDC gives short-lived tokens, with no long-lived cloud keys stored as secrets (AWS, Azure, GCP, Vault) | [GitHub OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect) |
| Agent "previews" | Claude Code cloud sessions. See the list below the table | [cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web); [environments](https://code.claude.com/docs/en/cloud-environments) |
| Hosted PR previews | Render creates a full stack per PR (Pro workspace or higher) with fresh, unseeded databases, billed per second, destroyed on merge | [Render previews](https://render.com/docs/preview-environments) |
| Secrets | Doppler Developer is free for 3 users, then Team at $21 per user. Infisical is free for 5 identities, is MIT-licensed and can be self-hosted | [Doppler](https://www.doppler.com/pricing); [Infisical](https://infisical.com/pricing) |
| Errors | Sentry Developer is free: 1 user, 5k errors, 5M spans, 30-day retention, 1 uptime monitor. Team is $26 a month (annual) with unlimited users and 50k errors. Business is $80 | [Sentry pricing](https://sentry.io/pricing/) |
| Traces and logs | Pydantic Logfire, free tier: 10M records a month hard-capped at $0, 30-day retention, 1 seat. Team is $49 (5 seats), then $2 per million records. US or EU regions. Built on OpenTelemetry, and the SDK can export to any OTLP backend through the `OTEL_EXPORTER_OTLP_*` variables | [pricing](https://pydantic.dev/pricing); [alternative backends](https://pydantic.dev/docs/logfire/guides/alternative-backends/) |
| Metrics, logs, uptime | Grafana Cloud Free: 10k series, 50 GB each of logs and traces, 14-day retention, 3 users, 100k synthetic API checks a month, alerting. Pro is $19 plus usage | [Grafana pricing](https://grafana.com/pricing/) |
| Uptime | UptimeRobot Free: 50 monitors at 5-minute intervals, described as "for hobby and non-profit". Solo is $9 (1-minute interval) | [UptimeRobot](https://uptimerobot.com/pricing/) |
| Vendor-neutral instrumentation | OpenTelemetry Python: `opentelemetry-bootstrap` plus `opentelemetry-instrument`, configured by `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_SERVICE_NAME` | [OTel Python zero-code](https://opentelemetry.io/docs/zero-code/python/) |
| Free credits | AWS: $100 at sign-up plus up to $100 more. The Free plan closes after 6 months or when the credits run out, unless upgraded. GCP: $300 for 90 days | [AWS Free](https://aws.amazon.com/free/); [GCP](https://docs.cloud.google.com/free/docs/free-cloud-features) |

What Claude Code cloud sessions provide, per the two docs cited in the table:
- Each session is a fresh Ubuntu 24.04 x86_64 VM with PostgreSQL 16, Redis and Docker
  pre-installed.
- Each VM has about 4 vCPUs, 16 GB of RAM and 30 GB of disk.
- Setup scripts must finish in about five minutes, and their result is cached as a snapshot.
- Network access can be limited to a custom list of domains.
- There is no separate compute charge for the VM.

---

## 4. Stage 1: development (now, one WSL2 machine). Target $0 a month.

**Where:** the owner's WSL2 machine, natively (Postgres 16 on 5544, Node 24 and uv/Python 3.13 are
already installed; `CLAUDE.md`). No Docker in dev. That removes one of the things that slowed the
ERP (postmortem §6).

**How:**
- **One repo, three processes:** `web` (the Python API and the frontend dev server), `worker` and
  Postgres.
- **LibreDWG** is built from source once, into a pinned prefix, and called as a subprocess.
- **Object storage** sits behind a small storage interface. In dev it is a local directory; in
  production it is S3-compatible.
- **The job queue** is a Postgres table read with `SELECT … FOR UPDATE SKIP LOCKED`, which
  Postgres documents for "multiple consumers accessing a queue-like table"
  ([PostgreSQL 16 SELECT](https://www.postgresql.org/docs/16/sql-select.html)). No Redis. There is
  one fewer moving part, and it is the same in every stage.
- **Showing the product** to the owner's phone or a friendly Developer: Cloudflare Tunnel makes
  outbound-only connections, so no public IP is needed
  ([docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)).
  A Zero Trust Free plan exists
  ([setup](https://developers.cloudflare.com/cloudflare-one/setup/)); I did not confirm its user
  limit.

**Previews for agentic development.**
- **Where agents work.** Claude Code cloud sessions are the per-task environment. The VM runs the
  whole stack natively: `service postgresql start`, then the app. No hosted per-PR preview is
  needed yet.
- **LibreDWG must be prebuilt.** A source build of LibreDWG inside the ~5-minute setup-script
  budget is doubtful. Build it once in GitHub Actions and publish it as a release artefact or GHCR
  image, and let the setup script download it. The cache keeps it after the first run.
- **Jev in the cloud VM** needs a Custom network allowlist entry for TypeSafe's API host.
- **The TypeSafe key in the cloud.** On Pro and Max plans an "API credential" can be attached
  outside the sandbox. Putting the key into Anthropic's environment settings at all is the owner's
  call, under the CLAUDE.md secret law.

**CI:** GitHub Actions on every PR: lint, types, unit tests and a Postgres service. It is free
while the repo is public.

**Secrets:** keep today's rule. `TYPESAFE_API_KEY` lives in `~/.bashrc`, and a `.env` file is
gitignored. CI uses GitHub Actions secrets.

**Observability from day one, in code, not in infrastructure:**
- Traces, spans and logs go through OpenTelemetry via the Logfire SDK, to the free tier. Each CAD
  job gets a span: file, reader, duration, entity counts, outcome. Each Jev call gets a span: the
  question id, latency and confidence.
- Exceptions go to Sentry Developer (free, one user).
- Because both are OpenTelemetry-based or OTLP-capable, the backend can be swapped later by
  environment variables alone.

**Error budget:** none. The gate at this stage is "real drawings run end to end on the owner's
machine" (postmortem rules), not an uptime number.

**Monthly cost: $0.** Excluded: the owner's Claude subscription, Jev calls (about a cent per
hundreds of calls; `docs/research/jev-system-one.md`) and a domain name.

---

## 5. Stage 2: beta with 3 to 10 Developers. About $87 to $123 a month.

**Recommendation: AWS Mumbai (`ap-south-1`).**

Why:
- **Latency.** It is the lowest measured from Dhaka (§1).
- **Compute price.** EC2 costs about half of Singapore's.
- **Managed Postgres with long PITR.** RDS keeps PITR for up to 35 days.
- **The Gulf.** A UAE region is at the same provider for later.
- **Credits.** AWS's new-account credits absorb the first months.
- **Lock-in stays low.** It is plain VMs, standard Postgres and the S3 API.

**How (keep it boring; one of each):**
```
Dhaka users ─HTTPS─► EC2 t4g.large (Mumbai): Caddy/nginx TLS ─► web container
                                            └─► worker container(s) ─ LibreDWG/ezdxf/IfcOpenShell subprocesses
                     RDS Postgres db.t4g.small (Single-AZ, PITR 14 days)
                     S3 bucket (versioned) for drawings and outputs
                     staging: EC2 t4g.small + a separate database on the same RDS instance
```
- **One image.** GitHub Actions builds one container image (web and worker share it) with LibreDWG
  compiled in a multi-stage build, pushes it to GHCR, and deploys over SSH. Kamal (containers on a
  plain VM with zero-downtime deploys; [kamal-deploy.org](https://kamal-deploy.org/)) or a
  `docker compose pull && up` both work. Containers appear only in deploy, not in dev.
- **Graviton (ARM) works.** IfcOpenShell 0.8.5 and ezdxf 1.4.4 publish `manylinux` aarch64 wheels
  (PyPI JSON API). LibreDWG is C built from source.
- **The t4g burst trap.** t4g instances are burstable. Sustained CAD jobs burn surplus credits at
  $0.04 per vCPU-hour. Move the worker to a c7g if the jobs are sustained rather than bursty.
- **CI to AWS** uses GitHub OIDC, so no AWS keys are stored in GitHub.

**Previews at beta:**
- One **staging** environment, auto-deployed from `main`, holding anonymised or permitted data only.
- Agents keep using Claude Code cloud sessions.
- Per-PR hosted previews only if the owner wants to click through PRs on a phone. The cheapest way
  is a labelled PR that starts a throwaway compose stack on the staging VM. Render's full-stack
  previews need its Pro plan and a move to Singapore.

**Observability at beta:**
- Logfire free (10M records a month is ample for 10 clients) for traces and logs.
- Sentry Team ($26) once more than one person must see errors.
- Uptime from Grafana Cloud Free synthetic checks (100k API checks a month), or Sentry's included
  uptime monitor. UptimeRobot Free describes itself as for hobby and non-profit use.
- Alerts go to the owner's phone and email.

**Error budget (proportionate):**
- **Availability target.** 99.5% monthly availability of the web app, as seen by the uptime check.
  That is 216 minutes of budget a month. The SRE workbook defines the budget as 100% minus the SLO,
  and advises starting from what you can measure rather than an ambitious number
  ([SRE workbook](https://sre.google/workbook/implementing-slos/)).
- **Job target.** 95% of drawing jobs finish, or fail with a plain message, within 5 minutes.
- **Data targets.** Lose at most about 5 minutes of data (RDS PITR). Restore within 4 hours during
  Dhaka business hours.
- **When the budget is spent,** the next work is reliability, not features.

**Hardening added at beta:**
- **Backups.**
  - RDS automated backups with 14-day PITR.
  - S3 versioning on the drawings bucket.
  - A monthly restore drill of RDS to staging, whose result is written down. A backup never
    restored is not a backup.
  - `pg_dump` weekly to a second provider (R2's free 10 GB) as a provider-exit copy.
- **Auth.**
  - Email sign-in with strong password hashing.
  - Sessions in HTTP-only cookies.
  - MFA (TOTP or passkeys) for our own staff and admin accounts. OWASP: "Require MFA for
    administrative or other high privileged users"
    ([OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)).
  - OWASP ASVS 5.0 (May 2025) Level 1 as the checklist ([ASVS](https://github.com/OWASP/ASVS)).
- **Tenant isolation.** A `tenant_id` on every row, enforced in the data-access layer, with
  Postgres Row-Level Security as the backstop. Table owners bypass RLS unless `FORCE ROW LEVEL
  SECURITY` is set, so the app must not connect as the owner
  ([PostgreSQL RLS](https://www.postgresql.org/docs/16/ddl-rowsecurity.html)).
- **Rate limits.**
  - Per IP and per account on sign-in.
  - Per tenant on uploads, with size caps.
  - Concurrent jobs per tenant.
  - A daily Jev-call budget per tenant.
- **Audit.**
  - An append-only audit table: who, tenant, what, when, before and after. It covers every
    Confirmation, rate or price change, export and permission change.
  - AWS CloudTrail on for the account.
- **Untrusted files.** LibreDWG and IfcOpenShell run on customer-supplied binaries. Run them in the
  worker only: as a non-root user, with no network, CPU-time and memory limits, and a wall-clock
  timeout.
- **Privacy and contracts.**
  - The client agreement and privacy notice name the subprocessors and their locations: AWS
    Mumbai, TypeSafe US, Sentry, Logfire (US or EU) and GitHub.
  - Take consent for cross-border processing (PDP Act s.29(3)).
  - Write a breach procedure.
  - Ask TypeSafe for its retention terms (ADR 0013).
- **Secrets.** Deploy-time secrets live in GitHub Environments; the runtime environment file is
  written by the deploy job. No secret sits in the image.

---

## 6. Stage 3: scale (Bangladesh, then the Gulf). About $860 to $1,110 a month for Bangladesh.

**Where:** AWS Mumbai stays home for Bangladesh. The Gulf gets a **separate cell** in
`me-central-1` (UAE), or in Bahrain or Saudi Arabia if the first Gulf clients' law requires it. It
has its own database and bucket, the same image, and tenants pinned to a cell. Everything that
differs by country is already data (ADR 0017).

**How:**
- **Services.** The same image runs on ECS Fargate as a `web` service (2 or more tasks behind a
  load balancer) and a `worker` service that scales on queue depth. On Fargate ARM that is $0.02383
  per vCPU-hour and $0.00261 per GB-hour.
- **Database.** RDS Multi-AZ, a read replica for reporting, and backups copied to a second region.
- **Secrets.** A managed store: AWS Secrets Manager, or Infisical (MIT-licensed, can be
  self-hosted).
- **Preview environments per PR** become worthwhile once several humans review. Options are
  short-lived ECS services against a Neon or RDS clone, or Render-style previews.

**Observability:**
- An OpenTelemetry collector.
- Logfire Team or Growth, or Grafana Cloud Pro.
- Sentry Business ($80) for SAML.
- SLO dashboards and burn-rate alerts.
- A public status page.
- An on-call rota.

**Error budget:**
- **Availability target.** 99.9% monthly, which is 43 minutes of budget.
- **Data targets.** Lose at most about 5 minutes of data. Restore within 1 hour.
- **Job target.** Per-tenant jobs meet 99% within their time limit.

**Hardening added at scale:**
- Multi-AZ and cross-region DR drills.
- AWS WAF and bot protection.
- SSO (SAML or OIDC) for enterprise clients.
- Per-tenant data export and deletion.
- An annual external penetration test.
- SOC 2 readiness, if Gulf enterprise buyers ask.
- A per-country data-residency review before each market opens.
- A formal incident process.

---

## 7. Cost table (USD a month)

| Line | Dev | Beta (AWS Mumbai) | Scale, Bangladesh (AWS Mumbai) |
|---|---|---|---|
| App compute | 0 (WSL2) | EC2 t4g.large 32.70 + gp3 30 GB 2.74 + IPv4 3.65 = **39.09** | Fargate ARM: web 2 × (1 vCPU, 2 GB) 42.41 + workers averaging 4 vCPU and 8 GB 84.83 = **127.24** |
| Staging | 0 | EC2 t4g.small 8.18 + 20 GB 1.82 + IPv4 3.65 = **13.65** | about 60 (a beta-size copy) *(estimate)* |
| Postgres | 0 (native) | RDS db.t4g.small 30.66 + 20 GB 2.62 = **33.28** | RDS db.m7g.large Multi-AZ 349.67 + about 100 GB storage (Multi-AZ storage rate not fetched; ≈26 if double the Single-AZ rate) = **≈376** |
| Object storage and egress | 0 | S3 50 GB 1.25; egress within the 100 GB free = **≈1.25** | S3 500 GB 12.50 + about 1 TB egress (924 GB × 0.1093) 101 = **≈114** |
| CI and registry | 0 (public repo) | 0 | 0 while public (else 2,000 free minutes, then $0.006 a minute) |
| Errors, traces, uptime | 0 (Sentry Dev, Logfire free) | 0 to 35 (Sentry Team 26; UptimeRobot Solo 9 optional) | ≈130 to 330 (Sentry Business 80; Logfire Team 49 to Growth 249) |
| Load balancer, NAT, WAF, CloudWatch | — | — | **not priced here**; allow ≈50 to 100 *(estimate, unverified)* |
| **Total** | **$0** | **≈$87 to $123** (the first months are largely covered by AWS's $100 to $200 in credits) | **≈$860 to $1,110** |

The Gulf cell starts at roughly beta size in `me-central-1`; I did not fetch its prices.

Beta alternatives, same shape:
- **DigitalOcean Bangalore.** Droplet 8 GB/4 vCPU $48, weekly backups (+20%) $9.60, Managed PG 1 GB
  $15.15 (7-day PITR), Spaces $5 and a staging Droplet 2 GB $12: **≈$90**. It is simpler to run.
  It has less headroom for enterprise controls, and I did not check its Gulf presence.
- **Render Singapore.** Pro $25, web 1 CPU/2 GB $25, worker 2 CPU/4 GB $85 and Postgres 1 GB $19:
  **≈$154** before previews. It has the best preview story and the most expensive CPU.
- **Hetzner Singapore.** CPX32 4 vCPU/8 GB $57.99, with no managed Postgres, so we would run
  backups ourselves. No longer a bargain.

## 8. Risks

1. **The stack grows back into the ERP.**
   - The risk: AWS makes it easy to add services, and the ERP died of stack weight.
   - Guard: at beta, one VM, one database and one bucket. No Kubernetes, no Redis, no
     microservices. Move to Fargate only when a measured limit forces it.
2. **Cheap hosts reprice.**
   - The risk: Hetzner Singapore's CPX22 went from €15.99 to €26.49 on 15 June 2026.
   - Guard: stay portable. One container image, standard Postgres, the S3 API, and a weekly
     off-provider dump.
3. **The Bangladesh law is new and its regulations are pending.**
   - s.29(4) lets regulations define acceptable destination countries.
   - The 2025 text's cloud-copy clause shows the direction regulators once took.
   - Guard: keep a documented relocation path. A Bangladeshi VPS host could run the same image,
     though none that I saw offers managed Postgres or an SLA.
4. **International links out of Bangladesh break.**
   - The risk: SEA-ME-WE 5 faults and maintenance slow or cut traffic towards Singapore.
   - Guard: Mumbai may be less exposed (an inference). Offline-tolerant uploads, meaning resumable
     and chunked, help whatever the region.
5. **Every Jev call crosses to the US** (0.22 to 0.28 s of round trip; retention unknown).
   - Guard: keep connections warm, batch questions, and degrade to the QS picking (ADR 0011).
6. **Free-tier traps.**
   - AWS's Free plan closes after 6 months unless upgraded.
   - Sentry Developer and Logfire free are one seat each.
   - UptimeRobot Free is for hobby use.
   - Actions is free only while the repo is public. A commercial product in a public repo is also
     the owner's call.
7. **LibreDWG is GPL-3.0** (GitHub API).
   - The risk: publishing a public container image that contains LibreDWG binaries is
     distribution and carries source obligations. Running it server-side as a separate process is
     the design already chosen.
   - Guard: have the licence position checked before the image is public.
8. **Untrusted DWG/IFC input.**
   - The risk: parsers of binary formats are an attack surface.
   - Guard: the sandboxing listed under beta hardening is required, not optional.
9. **Burstable CPU.**
   - The risk: t4g surplus credits cost $0.04 per vCPU-hour, so sustained CAD load on a t4g costs
     more than a c7g.
   - Guard: watch the credit balance in the beta.

## 9. What I don't know

- Real CAD job profiles: CPU-seconds and peak RAM per drawing set. The worker sizes above are
  guesses until the Sample Project runs.
- Whether TypeSafe's servers are on the US East or West coast. That shifts Jev's round trip by
  about 50 ms from Singapore.
- AWS load balancer, NAT, WAF, CloudWatch and Multi-AZ storage prices, and all `me-central-1`
  prices. I did not fetch them.
- The user limit of Cloudflare's Zero Trust Free plan. Fly MPG's regions. GCP and Azure prices in
  India.
- The date of the Daily Star cable-break article, and whether Mumbai traffic from Dhaka actually
  rides the terrestrial links to India.
- Whether any regulation under the PDP Act 2026 has been issued since April 2026. I found none, but
  bdlaws does not index regulations the same way it indexes Acts.

## 10. Decisions for the owner

1. **Beta host.** Recommended: AWS Mumbai, because it has the lowest latency and a path to
   enterprise controls and the Gulf. Alternative: DigitalOcean Bangalore, for simplicity at the
   same cost.
2. **Whether the product repo stays public.** That decides free CI, whether a GPL image can be
   published, and what agents can see.
3. **Whether the TypeSafe key may live in Claude Code cloud environments** (the CLAUDE.md secret
   law).
