# Development runs natively for free; the beta runs in AWS Mumbai; scale grows on measured triggers

1. **Development (about $0):** native on WSL2, no Docker. Claude Code cloud sessions serve as
   per-task previews. CI is GitHub Actions, where LibreDWG is built once and downloaded by sessions.
   Monitoring is on the Logfire and Sentry free tiers.
2. **Beta (about $87–123 a month):** AWS ap-south-1 (Mumbai), 44 ms from Dhaka as measured.
   - One VM runs the web and worker containers, with RDS Postgres (point-in-time restore, 14 days
     kept), S3 and a small staging VM.
   - Targets: 99.5 % uptime, about 5 minutes of data loss at most, restored within 4 hours.
   - Hardening: backups with a monthly restore drill; staff MFA; row-level security; rate limits
     and an audit table; CAD parsers sandboxed with no network; client terms naming where data is
     processed.
3. **Scale (about $860–1,110 a month for Bangladesh):** the same image on ECS Fargate, Multi-AZ RDS,
   and workers that scale with the queue. The Gulf gets its own deployment in AWS's UAE region.

Bangladesh's Personal Data Protection Act 2026 allows data abroad with consent or under a contract
(our reading, not legal advice; a lawyer checks before the beta). The alternative for the beta was
DigitalOcean Bangalore. Details: docs/research/stack-deploy.md.
