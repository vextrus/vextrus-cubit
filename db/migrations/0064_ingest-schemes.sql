ALTER TABLE "ingests" DROP CONSTRAINT "ingests_extractor_scheme_closed";--> statement-breakpoint
ALTER TABLE "ingests" ADD COLUMN "trace_tool" text;--> statement-breakpoint
ALTER TABLE "ingests" ADD COLUMN "trace_tool_version" text;--> statement-breakpoint
ALTER TABLE "ingests" ADD COLUMN "trace_parameter_set_hash" text;--> statement-breakpoint
ALTER TABLE "ingests" ADD CONSTRAINT "ingests_trace_identity_whole" CHECK (("ingests"."trace_tool" is null and "ingests"."trace_tool_version" is null and "ingests"."trace_parameter_set_hash" is null) or ("ingests"."trace_tool" is not null and "ingests"."trace_tool_version" is not null and "ingests"."trace_parameter_set_hash" is not null and "ingests"."extractor_scheme" = 'PDF_OBJECT'));--> statement-breakpoint
ALTER TABLE "ingests" ADD CONSTRAINT "ingests_extractor_scheme_closed" CHECK ("ingests"."extractor_scheme" in ('DXF_HANDLE', 'PDF_OBJECT', 'RASTER_TRACE'));