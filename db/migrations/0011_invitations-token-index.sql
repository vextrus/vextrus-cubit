ALTER TABLE "invitations" DROP CONSTRAINT "invitations_token_hash_unique";--> statement-breakpoint
CREATE INDEX "invitations_token_hash" ON "invitations" USING btree ("token_hash");