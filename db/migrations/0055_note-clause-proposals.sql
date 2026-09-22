CREATE TABLE "note_clause_proposals" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"layout_name" text NOT NULL,
	"source_key" text NOT NULL,
	"ordinal" integer NOT NULL,
	"clause" text NOT NULL,
	"kind" text,
	"value_as_written" text,
	"unit_as_written" text,
	"canonical" text,
	"governs" numeric,
	"call_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_clause_proposals_key" PRIMARY KEY("tenant_id","ingest_id","source_key","ordinal"),
	CONSTRAINT "note_clause_proposals_kind_closed" CHECK ("note_clause_proposals"."kind" is null or "note_clause_proposals"."kind" in ('FY', 'FC', 'LAP', 'HOOK', 'HOOK_MIN')),
	CONSTRAINT "note_clause_proposals_figure_whole" CHECK (("note_clause_proposals"."canonical" is null) = ("note_clause_proposals"."value_as_written" is null) and ("note_clause_proposals"."canonical" is null) = ("note_clause_proposals"."unit_as_written" is null)),
	CONSTRAINT "note_clause_proposals_figure_classed" CHECK ("note_clause_proposals"."canonical" is null or "note_clause_proposals"."kind" is not null),
	CONSTRAINT "note_clause_proposals_governs_is_probability" CHECK ("note_clause_proposals"."governs" is null or ("note_clause_proposals"."governs" >= 0 and "note_clause_proposals"."governs" <= 1)),
	CONSTRAINT "note_clause_proposals_clause_said" CHECK (length(btrim("note_clause_proposals"."clause")) > 0)
);
--> statement-breakpoint
CREATE INDEX "note_clause_proposals_by_sheet" ON "note_clause_proposals" USING btree ("tenant_id","drawing_id","layout_name");
--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
--
-- R-TO-034, L-AI-02: what a model offered about a sheet's general-note clauses is tenant data — the
-- clause's own words, the class proposed for it and the ledger call that proposed it — and wears the
-- seam's full posture: row-level security ENABLED and FORCED, the tenant scope every statement of a
-- tenant's own session satisfies, and the system scope a named reason opens for the platform's own
-- work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "note_clause_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "note_clause_proposals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "note_clause_proposals_tenant_scope" ON "note_clause_proposals"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "note_clause_proposals_system_scope" ON "note_clause_proposals"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- An OFFER is derived from an artifact and rebuilt whole per ingest — the rows are deleted and
-- written again in one transaction — so unlike a ledger the app role really holds a DELETE here.
-- What makes the table trustworthy is the scope above and the content-derived key, never an absence
-- of privilege (R-TO-034, L-AI-02, L-REG-04).
GRANT SELECT, INSERT, DELETE ON TABLE "note_clause_proposals" TO "cubit_app";
