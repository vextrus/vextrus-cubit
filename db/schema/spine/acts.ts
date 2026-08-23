/**
 * `public.acts` — the append-only ledger of what members did (L-ACT-02's substrate).
 *
 * This increment founds the minimal table the `MEMBER_HAS_ACTS` predicate needs and nothing
 * more: R-SPINE-003 refuses to remove a member "while the member holds acts on open
 * campaigns", and a predicate with no rows to read is a refusal that can never fire. The full
 * act machinery — preview/commit pairs, consequence digests, the act log explorer — is a later
 * increment's, and campaigns are not entities yet.
 *
 * At M0 nothing can close a campaign, so every act whose `campaign_ref` is set is an act on an
 * open campaign (docs/design/s-settings.md Interpretation 7). A later campaign-bearing
 * increment refines the predicate; the row shape here is what it refines.
 *
 * Append-only is a grant, not a convention: `cubit_app` holds SELECT and INSERT on this table
 * and neither UPDATE nor DELETE, so an act that happened cannot be edited into one that did
 * not.
 */
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from '../core/tenants';
import { users } from './users';

export const acts = pgTable('acts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  /** What was done, as a code. The closed set arrives with the machinery that raises them. */
  actType: text('act_type').notNull(),
  /** The campaign the act sits on, when it sits on one. Null is "no campaign of its own". */
  campaignRef: text('campaign_ref'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
