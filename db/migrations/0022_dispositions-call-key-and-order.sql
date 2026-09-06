-- Ahead of the composite foreign key below, which references it: the generator emits its ALTERs
-- table by table, and a reference to a key that does not exist yet cannot be added.
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_call_per_tenant" UNIQUE("tenant_id","call_id");--> statement-breakpoint
ALTER TABLE "sheet_understanding_dispositions" DROP CONSTRAINT "sheet_understanding_dispositions_call_id_model_calls_call_id_fk";
--> statement-breakpoint
DROP INDEX "sheet_understanding_dispositions_by_project";--> statement-breakpoint
ALTER TABLE "sheet_understanding_dispositions" ADD COLUMN "recorded_seq" bigint NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "sheet_understanding_dispositions_recorded_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "sheet_understanding_dispositions" ADD CONSTRAINT "sheet_understanding_dispositions_call_fk" FOREIGN KEY ("tenant_id","call_id") REFERENCES "public"."model_calls"("tenant_id","call_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sheet_understanding_dispositions_by_project" ON "sheet_understanding_dispositions" USING btree ("tenant_id","project_id","created_at","recorded_seq");