-- L-ACT-01/L-ACT-03: the belt on what a person AUTHORED about a typical plan.
--
-- `typical_ranges` holds one statement per view: which floors a plan is typical of, and the act that
-- made it. The runtime may add one and may neither rewrite nor remove one (0033's grants), and
-- L-ACT-03 says the ledger a person's judgement lands in "never wears weaker belts than the
-- parameter store" — so the owner is bound by the same trigger the act log and the rule-set editions
-- wear, and by the one spelling of the rule (0001_act-log.sql's "cubit_append_only"): one rule, one
-- home (B-17).
--
-- Hand-written: a trigger is not a thing drizzle-kit models, so no column, key or check moves here
-- and the snapshot beside this entry says exactly what 0033's does.
CREATE TRIGGER "typical_ranges_append_only" BEFORE UPDATE OR DELETE ON "typical_ranges"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "typical_ranges_append_only_truncate" BEFORE TRUNCATE ON "typical_ranges"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();
