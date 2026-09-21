#!/usr/bin/env node
// Apply the committed migrations to the dev lane's own database (cubit_dev), as `pnpm dev` does on
// start — for the machine whose dev database stands behind the chain when a migration lands, which
// `pnpm checkup`'s `dev-db` probe refuses by name (ARCH-02, C-06; docs/decisions/dev-lane.md).
//   pnpm db:migrate:dev
import { devDatabaseUrl, migrateDatabase, ROLE_MIGRATE } from "./lib/pg-database.mjs";

const url = devDatabaseUrl(ROLE_MIGRATE);
migrateDatabase(url);
process.stdout.write(`cubit_dev migrated to the committed head\n`);
