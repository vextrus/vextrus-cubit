import { z } from 'zod';

/**
 * The environment, validated at its boundary with zod.
 *
 * Two readers, because two lanes have different needs: `pnpm test:db` cuts a
 * scratch database and proves RLS without ever minting a session, so the
 * database seam asks only for the three role URLs. The app asks for everything.
 *
 * Validation is deferred to first read, so `next build` — which touches neither
 * a database nor a mailbox — does not demand a populated `.env`.
 */
const databaseSchema = z.object({
  DATABASE_URL_MIGRATE: z.string().min(1),
  DATABASE_URL_APP: z.string().min(1),
  DATABASE_URL_AUTH: z.string().min(1),
});

const appSchema = databaseSchema.extend({
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().min(1),

  MAIL_TRANSPORT: z.enum(['file', 'none']).default('file'),
  MAIL_OUTBOX_DIR: z.string().default('.mail-outbox/'),

  PORT: z.coerce.number().int().positive().default(3210),
});

export type DatabaseEnv = z.infer<typeof databaseSchema>;
export type Env = z.infer<typeof appSchema>;

function reader<T extends object>(schema: z.ZodType<T>, lane: string): T {
  let cached: T | undefined;

  const load = (): T => {
    if (cached !== undefined) return cached;
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
      throw new Error(`Environment is not usable for ${lane} — see .env.example for: ${names}`);
    }
    cached = parsed.data;
    return cached;
  };

  return new Proxy({} as T, {
    get: (_target, property: string) => load()[property as keyof T],
    has: (_target, property: string) => property in load(),
    ownKeys: () => Reflect.ownKeys(load()),
    getOwnPropertyDescriptor: (_target, property: string) => ({
      value: load()[property as keyof T],
      enumerable: true,
      configurable: true,
    }),
  });
}

/** Everything the running application needs. Nothing else reads `process.env`. */
export const env: Env = reader(appSchema, 'the application');

/** The three role URLs, and only those (SEAM-TENANT). */
export const databaseEnv: DatabaseEnv = reader(databaseSchema, 'the database seam');
