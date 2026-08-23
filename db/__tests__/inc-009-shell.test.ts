/**
 * inc-009 acceptance — the shell as a reader's browser receives it (AC-1, AC-2, AC-3, AC-4;
 * R-UI-030, R-UI-031, R-UI-033, R-UI-050).
 *
 * It lives under db/__tests__ because it spawns `pnpm e2e`, which drops and recreates a
 * database and builds the app: `pnpm verify`'s vitest stage and CI both run without a
 * provisioned cluster, and a lane-spawning test there would be red for a reason that has
 * nothing to do with the code under review. That is the same reading inc-001 recorded and
 * inc-008 followed, and it is run as
 *
 *     pnpm test:db db/__tests__/inc-009-shell.test.ts
 *
 * A bare `pnpm vitest run db/__tests__/...` finds no tests: the root config excludes db/**.
 *
 * Two arms:
 *
 *   LANE — `pnpm e2e --journey J-000` exits 0 and the shell slice really ran inside it. The
 *   journey's own claims are its file's; what is asserted here is that the grep selects it,
 *   because a journey nothing selects is a journey nobody runs (`--journey` is a title grep).
 *
 *   SERVED — the build that lane produced, started once against the database it seeded, then
 *   driven over HTTP with a real session cookie. Every claim below is read off the bytes the
 *   server sent: R-UI-031 says the URL is the source of truth, so a fresh GET of each area is
 *   exactly the right instrument, and it needs no browser. What genuinely needs one — the
 *   rail's collapse, the switcher menu, browser back — is the journey's and the held-out
 *   set's.
 *
 * Nothing here reads src/app/** or src/ui/shell/** to find out what the Builder meant. The
 * copy is read from the Design Decision the screens are graded against; everything else is a
 * status code, a test id from the increment's test contract, or a landmark element.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO, isNested, lastLine, run } from './support/lanes';
import type { Ran } from './support/lanes';
import { APP_ROLE, connectTo, endAll, query, urlFor } from './support/live';
import type { Client } from 'pg';

/* ────────────────────────────── what the contract fixes ────────────────────────────── */

/** The journey and page object the test contract names (C-05). */
const SHELL_JOURNEY = ['tests', 'e2e', 'shell.spec.ts'];
const SHELL_PAGE_OBJECT = ['tests', 'e2e', 'pages', 'shell.ts'];

/** The Design Decision the shell is graded against — and the source of every string below. */
const DESIGN_DOC = ['docs', 'design', 'shell.md'];

/** The journey lane's contract line and budget (C-06); a build and a browser are minutes. */
const LANE_OK = /^e2e: ok \(\d+(\.\d+)?s\)$/;
const LANE_BUDGET_MS = 1_200_000;

/** The e2e lane's own database and build output, which this file reads after the lane ran. */
const E2E_DB = (() => {
  const name = process.env['CUBIT_E2E_DB'];
  return name === undefined || name.trim() === '' ? 'cubit_e2e' : name;
})();
const E2E_DIST = '.next-e2e';

/**
 * AC-1's frame, as test ids. `tenant-switcher-item` is deliberately absent: it lives inside a
 * menu that is closed until somebody opens it, so it is the browser's claim, not the
 * document's.
 */
const FRAME_TESTIDS: readonly string[] = [
  'shell-rail',
  'rail-toggle',
  'rail-tenant-switcher',
  'rail-nav-projects',
  'rail-nav-books',
  'rail-nav-settings',
  'shell-topbar',
  'topbar-breadcrumb',
  'topbar-project-switcher',
  'topbar-command',
  'topbar-jobs',
  'topbar-notifications',
  'topbar-user',
  'shell-main',
  'shell-inspector',
];

/** The three areas AC-2 makes deep-linkable, with the rail item each one marks as current. */
interface Area {
  readonly segment: string;
  readonly navTestId: string;
  readonly titleKey: string;
  readonly teachKey: string;
  readonly actionKey: string;
}

const AREAS: readonly Area[] = [
  {
    segment: 'projects',
    navTestId: 'rail-nav-projects',
    titleKey: 'tenant.projects.title',
    teachKey: 'tenant.projects.empty.teach',
    actionKey: 'tenant.projects.empty.action',
  },
  {
    segment: 'books',
    navTestId: 'rail-nav-books',
    titleKey: 'tenant.books.title',
    teachKey: 'tenant.books.empty.teach',
    actionKey: 'tenant.books.empty.action',
  },
  {
    segment: 'settings',
    navTestId: 'rail-nav-settings',
    titleKey: 'tenant.settings.title',
    teachKey: 'tenant.settings.empty.teach',
    actionKey: 'tenant.settings.empty.action',
  },
];

/** The accessible names §3 and §5 decide for the frame's regions and later-milestone slots. */
const FRAME_NAME_KEYS: readonly string[] = [
  'shell.rail.label',
  'shell.breadcrumb',
  'shell.topbar.command',
  'shell.topbar.jobs',
  'shell.topbar.notifications',
  'shell.user',
  'shell.inspector',
];

/**
 * What the journey has to have walked, each as the ways a journey can spell it. The three
 * areas, the browser's own back button, and the session list still operable inside the shell
 * — the checkpoints the Increment Spec names for the J-000 shell slice.
 */
const JOURNEY_MARKS: readonly (readonly string[])[] = [
  ['/projects'],
  ['/books'],
  ['/settings'],
  ['goBack', 'Alt+ArrowLeft'],
  ['session-row'],
];

/** The password the minted member signs up with, and the name their personal tenant takes. */
const PASSWORD = 'inc009-Passw0rd!';
const MEMBER_NAME = 'Inc009 Member';

/** How long the verification mail may take: better-auth sends some of it after answering. */
const MAIL_DEADLINE_MS = 20_000;
const MAIL_POLL_MS = 200;

const at = (...parts: string[]): string => join(REPO, ...parts);
const there = (...parts: string[]): boolean => existsSync(at(...parts));
const read = (...parts: string[]): string => readFileSync(at(...parts), 'utf8');

const open: Client[] = [];

afterAll(async () => {
  await endAll(open);
  open.length = 0;
});

async function systemClient(url: string): Promise<Client> {
  const client = await connectTo(url);
  open.push(client);
  await client.query("select set_config('cubit.scope', 'system', false)");
  return client;
}

/** The last of a lane's output, which is where its reason for failing is. */
function tail(merged: string): string {
  return merged
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(-40)
    .join('\n');
}

/* ─────────────────────────────── the decided copy (§7) ─────────────────────────────── */

/**
 * docs/design/shell.md §7, as key → value.
 *
 * The strings this file looks for on screen are read from the Design Decision rather than
 * typed in here: the designer owns the words, and an assertion that copied them would have
 * to be edited every time they lawfully changed.
 */
function decidedCopy(): Map<string, string> {
  const doc = read(...DESIGN_DOC);
  const section = doc.split(/^## 7\./m)[1]?.split(/^## 8\./m)[0] ?? '';
  const rows = new Map<string, string>();
  for (const line of section.split('\n')) {
    const match = /^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (match === null) continue;
    const [, key, value] = match;
    if (key !== undefined && value !== undefined) rows.set(key, value);
  }
  if (rows.size < 20) {
    throw new Error(`docs/design/shell.md §7 could not be read — it yielded ${rows.size} rows`);
  }
  return rows;
}

/** Read once, on the first claim that needs a word — never at collection time. */
let copyOnce: Map<string, string> | undefined;

function copy(key: string): string {
  copyOnce ??= decidedCopy();
  const value = copyOnce.get(key);
  expect(value, `docs/design/shell.md §7 has no row for ${key}`).toBeDefined();
  return value ?? '';
}

/* ──────────────────────────────── reading the document ──────────────────────────────── */

/** The opening tag of the element carrying a test id, or undefined if nothing carries it. */
function openingTag(html: string, testId: string): string | undefined {
  const marker = `data-testid="${testId}"`;
  const found = html.indexOf(marker);
  if (found === -1) return undefined;
  const start = html.lastIndexOf('<', found);
  const end = html.indexOf('>', found);
  if (start === -1 || end === -1) return undefined;
  return html.slice(start, end + 1);
}

const carries = (html: string, testId: string): boolean =>
  html.includes(`data-testid="${testId}"`);

/** Where a test id first appears, so "inside" can be read as "opened before". */
const positionOf = (html: string, testId: string): number =>
  html.indexOf(`data-testid="${testId}"`);

/**
 * Whether an element is the landmark it is supposed to be — either by its element name or by
 * the explicit role. Which of the two a Builder reaches for is theirs to decide; that a
 * screen reader finds a main, a banner, a navigation and a complementary region is not.
 */
function isLandmark(tag: string, element: string, role: string): boolean {
  return tag.startsWith(`<${element}`) || tag.includes(`role="${role}"`);
}

/** One `<nav data-testid="topbar-breadcrumb">…</nav>`, as text. */
function breadcrumbText(html: string): string {
  const found = positionOf(html, 'topbar-breadcrumb');
  if (found === -1) return '';
  const closed = html.indexOf('</nav>', found);
  const slice = html.slice(found, closed === -1 ? found : closed);
  return slice.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

/* ─────────────────────────────── the lane and the server ─────────────────────────────── */

/**
 * `pnpm e2e --journey J-000`, run once for every claim that reads it.
 *
 * A `beforeAll` that threw would report its tests as skipped rather than failed, so the run
 * is memoised into a promise each test awaits: a lane that cannot start fails every test that
 * needs it, by name.
 */
let laneOnce: Promise<Ran> | undefined;
function laneRun(): Promise<Ran> {
  laneOnce ??= run('pnpm', ['run', 'e2e', '--journey', 'J-000']);
  return laneOnce;
}

interface Served {
  readonly port: number;
  readonly stop: () => Promise<void>;
}

/**
 * The build that lane produced, served once against the database it migrated and seeded. This
 * costs a `next start` and nothing else — a second `next build` would prove nothing and take
 * minutes.
 */
let servedOnce: Promise<Served> | undefined;
function servedApp(): Promise<Served> {
  servedOnce ??= (async () => {
    await laneRun();
    if (!there(E2E_DIST)) {
      throw new Error(
        `${E2E_DIST} is not in the tree — \`pnpm e2e --journey J-000\` did not get as far as a build`,
      );
    }
    const port = await freePort();
    return { port, stop: await serveBuild(port) };
  })();
  return servedOnce;
}

afterAll(async () => {
  if (servedOnce === undefined) return;
  try {
    await (await servedOnce).stop();
  } catch {
    /* it never came up; the failing tests already say why */
  }
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => (port === 0 ? reject(new Error('no free port')) : resolve(port)));
    });
  });
}

/**
 * The e2e build, on a port of its own, against the e2e database. Its own process group:
 * `next start` is a parent, and killing the pid alone can leave a worker holding the port.
 */
async function serveBuild(port: number): Promise<() => Promise<void>> {
  const server = spawn(
    join(REPO, 'node_modules', '.bin', 'next'),
    ['start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: REPO,
      env: {
        ...process.env,
        DATABASE_URL: urlFor(E2E_DB, APP_ROLE),
        NEXT_DIST_DIR: E2E_DIST,
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  );
  let said = '';
  const collect = (chunk: Buffer): void => {
    said += chunk.toString('utf8');
  };
  server.stdout?.on('data', collect);
  server.stderr?.on('data', collect);

  const stop = async (): Promise<void> => {
    if (server.exitCode !== null || server.pid === undefined) return;
    await new Promise<void>((resolve) => {
      const hard = setTimeout(() => {
        try {
          process.kill(-(server.pid as number), 'SIGKILL');
        } catch {
          /* already gone */
        }
      }, 5_000);
      server.on('close', () => {
        clearTimeout(hard);
        resolve();
      });
      try {
        process.kill(-(server.pid as number), 'SIGTERM');
      } catch {
        clearTimeout(hard);
        resolve();
      }
    });
  };

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited ${server.exitCode} before it served:\n${said}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
      await response.text();
      if (response.status < 500) return stop;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  await stop();
  throw new Error(`the served build did not answer on ${port} within 120s:\n${said}`);
}

/* ──────────────────────────────── a session, over HTTP ──────────────────────────────── */

/** A cookie jar of its own, so "with a session" and "without one" are two different readers. */
type Jar = Map<string, string>;

function absorb(response: Response, jar: Jar): void {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0] ?? '';
    const split = pair.indexOf('=');
    if (split <= 0) continue;
    jar.set(pair.slice(0, split).trim(), pair.slice(split + 1));
  }
}

const cookieHeader = (jar: Jar): string =>
  [...jar].map(([name, value]) => `${name}=${value}`).join('; ');

interface Answered {
  readonly status: number;
  readonly url: string;
  readonly body: string;
  readonly location: string | null;
}

/** One request, no redirect followed — the guard's own answer, as it left the server. */
async function ask(url: string, jar: Jar): Promise<Answered> {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: jar.size === 0 ? {} : { cookie: cookieHeader(jar) },
  });
  absorb(response, jar);
  return {
    status: response.status,
    url,
    body: await response.text(),
    location: response.headers.get('location'),
  };
}

/** The same, following redirects by hand and keeping every cookie they set on the way. */
async function follow(url: string, jar: Jar): Promise<Answered> {
  let current = url;
  for (let hop = 0; hop < 8; hop += 1) {
    const answered = await ask(current, jar);
    if (answered.status < 300 || answered.status >= 400 || answered.location === null) {
      return { ...answered, url: current };
    }
    current = new URL(answered.location, current).toString();
  }
  throw new Error(`more than 8 redirects from ${url}`);
}

async function post(url: string, body: unknown, jar: Jar): Promise<Answered> {
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      ...(jar.size === 0 ? {} : { cookie: cookieHeader(jar) }),
    },
    body: JSON.stringify(body),
  });
  absorb(response, jar);
  return {
    status: response.status,
    url,
    body: await response.text(),
    location: response.headers.get('location'),
  };
}

/** The newest verification link sent to an address, out of the mail seam's own table. */
async function verificationLink(email: string): Promise<string> {
  const outbox = await systemClient(urlFor(E2E_DB, APP_ROLE));
  const deadline = Date.now() + MAIL_DEADLINE_MS;
  for (;;) {
    const rows = await query(
      outbox,
      `select url from public.auth_mail_outbox
        where to_email = $1 and kind = 'verify'
        order by created_at desc, id desc
        limit 1`,
      [email],
    );
    const url = rows[0]?.['url'];
    if (typeof url === 'string') return url;
    if (Date.now() >= deadline) {
      throw new Error(`no verification mail for ${email} within ${MAIL_DEADLINE_MS}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, MAIL_POLL_MS));
  }
}

interface Member {
  readonly jar: Jar;
  readonly slug: string;
  readonly tenantName: string;
  readonly email: string;
}

/**
 * A signed-in member of a tenant of their own, minted once for the whole file.
 *
 * The route is the product's: sign up, ask for the verification mail, open the link the mail
 * seam holds. That is what a person does, and it is the only way to a cookie this suite is
 * allowed to hold — a session row written by hand would prove the shell renders for a
 * session the guard never issued.
 */
let memberOnce: Promise<Member> | undefined;
function signedInMember(): Promise<Member> {
  memberOnce ??= (async () => {
    const { port } = await servedApp();
    const base = `http://127.0.0.1:${port}`;
    const email = `inc009-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
    const jar: Jar = new Map();

    const signedUp = await post(
      `${base}/api/auth/sign-up/email`,
      { email, password: PASSWORD, name: MEMBER_NAME },
      jar,
    );
    expect(
      signedUp.status,
      `POST /api/auth/sign-up/email answered ${signedUp.status}: ${signedUp.body.slice(0, 300)}`,
    ).toBeLessThan(400);

    const asked = await post(
      `${base}/api/auth/send-verification-email`,
      { email, callbackURL: '/t' },
      jar,
    );
    expect(
      asked.status,
      `POST /api/auth/send-verification-email answered ${asked.status}: ${asked.body.slice(0, 300)}`,
    ).toBeLessThan(400);

    const landed = await follow(await verificationLink(email), jar);
    const path = new URL(landed.url).pathname;
    const slug = path.split('/')[2] ?? '';
    expect(
      slug,
      `the verification link landed on ${path}, not /t/{tenantSlug} — no session to read the shell with`,
    ).not.toBe('');

    const reader = await systemClient(urlFor(E2E_DB, APP_ROLE));
    const rows = await query(reader, 'select name from public.tenants where slug = $1', [slug]);
    const tenantName = String(rows[0]?.['name'] ?? '');
    return { jar, slug, tenantName, email };
  })();
  return memberOnce;
}

/** One shell route, as the signed-in member receives it. */
async function shellPage(path: string): Promise<Answered> {
  const { port } = await servedApp();
  const member = await signedInMember();
  const answered = await follow(`http://127.0.0.1:${port}${path}`, member.jar);
  expect(answered.status, `GET ${path} answered ${answered.status}`).toBe(200);
  return answered;
}

/* ──────────────────────────────────── the claims ──────────────────────────────────── */

describe('inc-009 — the J-000 shell slice is in the lane (AC-1, AC-2, AC-3)', () => {
  it('ships tests/e2e/shell.spec.ts and its page object, and the journey walks the areas', () => {
    expect(
      there(...SHELL_JOURNEY),
      'tests/e2e/shell.spec.ts is not in the tree — the test contract names it as the J-000 shell slice',
    ).toBe(true);
    expect(
      there(...SHELL_PAGE_OBJECT),
      'tests/e2e/pages/shell.ts is not in the tree — the test contract names it as the shell page object',
    ).toBe(true);

    const journey = read(...SHELL_JOURNEY);
    // The journey speaks to the shell through its page object, the way j-001 speaks through
    // pages/auth.ts: selectors said once, in the file the Builder may edit.
    expect(
      /pages\/shell/.test(journey),
      'tests/e2e/shell.spec.ts does not import its page object',
    ).toBe(true);

    const absent = JOURNEY_MARKS.filter(
      (spellings) => !spellings.some((mark) => journey.includes(mark)),
    ).map((spellings) => spellings.join(' | '));
    expect(
      absent,
      'the J-000 shell slice never mentions these — a checkpoint it does not walk is a checkpoint nobody runs',
    ).toEqual([]);
  });

  it(
    '`pnpm e2e --journey J-000` exits 0 and the grep really selected the shell slice',
    async (ctx) => {
      if (isNested()) ctx.skip();
      const ran = await laneRun();

      expect(ran.code, `pnpm e2e --journey J-000 exited ${ran.code}\n${tail(ran.merged)}`).toBe(0);
      // The contract line is on stdout; the build, the migrations and Playwright's report are
      // detail on stderr (C-06).
      expect(lastLine(ran.stdout), tail(ran.merged)).toMatch(LANE_OK);

      // `--journey` is a Playwright title grep, so a shell test whose title does not carry
      // J-000 is a test the Golden Path never runs. The runner names the file of every test
      // it selected, which is the honest way to ask whether the grep reached this one.
      expect(
        ran.merged.includes('shell.spec.ts'),
        `the J-000 run never mentions shell.spec.ts — do its titles carry "J-000"?\n${tail(ran.merged)}`,
      ).toBe(true);
    },
    LANE_BUDGET_MS,
  );
});

describe('AC-1 — the shell frame renders on every signed-in tenant route (R-UI-030)', () => {
  it(
    'carries the rail, the top bar, a main landmark and a complementary inspector',
    async () => {
      const member = await signedInMember();
      const home = await shellPage(`/t/${member.slug}`);

      const missing = FRAME_TESTIDS.filter((id) => !carries(home.body, id));
      expect(missing, `/t/${member.slug} rendered no such element for these test ids`).toEqual([]);

      // R-UI-030's regions, as landmarks a screen reader can jump between (R-UI-060).
      const rail = openingTag(home.body, 'shell-rail') ?? '';
      const topbar = openingTag(home.body, 'shell-topbar') ?? '';
      const main = openingTag(home.body, 'shell-main') ?? '';
      const inspector = openingTag(home.body, 'shell-inspector') ?? '';
      expect(isLandmark(rail, 'nav', 'navigation'), `shell-rail is not a nav: ${rail}`).toBe(true);
      expect(
        isLandmark(topbar, 'header', 'banner'),
        `shell-topbar is not the page's banner: ${topbar}`,
      ).toBe(true);
      expect(isLandmark(main, 'main', 'main'), `shell-main is not a main landmark: ${main}`).toBe(
        true,
      );
      expect(
        isLandmark(inspector, 'aside', 'complementary'),
        `shell-inspector is not a complementary region: ${inspector}`,
      ).toBe(true);

      // AC-1: "every slot has an accessible name", and the later-milestone slots answer with
      // the honest empty affordance the Design Decision defines rather than a dead control.
      const unnamed = FRAME_NAME_KEYS.filter((key) => !home.body.includes(copy(key)));
      expect(
        unnamed.map((key) => `${key} = ${copy(key)}`),
        'these accessible names from docs/design/shell.md §7 are nowhere in the document',
      ).toEqual([]);
    },
    LANE_BUDGET_MS,
  );

  it(
    'keeps J-001’s surfaces working: tenant-home and the session list render inside the shell',
    async () => {
      const member = await signedInMember();

      const home = await shellPage(`/t/${member.slug}`);
      expect(carries(home.body, 'tenant-home'), 'tenant-home is gone from /t/{tenantSlug}').toBe(
        true,
      );
      // "Inside the shell": the main region opens before the screen it holds.
      expect(
        positionOf(home.body, 'shell-main'),
        'tenant-home does not render inside shell-main',
      ).toBeLessThan(positionOf(home.body, 'tenant-home'));

      const sessions = await shellPage(`/t/${member.slug}/sessions`);
      expect(
        carries(sessions.body, 'session-row'),
        '/t/{tenantSlug}/sessions lists no session-row — J-001 asserts it does',
      ).toBe(true);
      expect(
        carries(sessions.body, 'shell-rail'),
        'the session list no longer renders inside the shell',
      ).toBe(true);
      expect(
        positionOf(sessions.body, 'shell-main'),
        'the session list does not render inside shell-main',
      ).toBeLessThan(positionOf(sessions.body, 'session-row'));
    },
    LANE_BUDGET_MS,
  );
});

describe('AC-2 — the URL is the source of truth (R-UI-031)', () => {
  it(
    'deep-links each area: a fresh GET renders it inside the shell, breadcrumbed and marked current',
    async () => {
      const member = await signedInMember();

      for (const area of AREAS) {
        const page = await shellPage(`/t/${member.slug}/${area.segment}`);

        // The frame is the same frame on every area — one persistent layout (R-UI-030).
        const missing = FRAME_TESTIDS.filter((id) => !carries(page.body, id));
        expect(missing, `/${area.segment} rendered no such element for these test ids`).toEqual([]);

        // The area's own heading copy, decided in §7.
        expect(
          page.body.includes(copy(area.titleKey)),
          `/${area.segment} does not show ${copy(area.titleKey)}`,
        ).toBe(true);

        // "topbar-breadcrumb reflecting tenant and area from the URL" — both crumbs, derived
        // from nothing but the address.
        const crumbs = breadcrumbText(page.body);
        expect(crumbs, `the breadcrumb on /${area.segment} does not name the tenant`).toContain(
          member.tenantName,
        );
        expect(crumbs, `the breadcrumb on /${area.segment} does not name the area`).toContain(
          copy(area.titleKey),
        );

        // "the current area's rail item marked aria-current='page'" — and only that one, or
        // the mark says nothing (R-UI-060: never tint alone).
        for (const other of AREAS) {
          const tag = openingTag(page.body, other.navTestId) ?? '';
          const current = tag.includes('aria-current="page"');
          expect(
            current,
            `on /${area.segment}, ${other.navTestId} ${current ? 'is' : 'is not'} aria-current="page"`,
          ).toBe(other.segment === area.segment);
        }
      }
    },
    LANE_BUDGET_MS,
  );

  it(
    'never hands shell bytes to a signed-out reader, and keeps no loading boundary above the guard',
    async (ctx) => {
      if (isNested()) ctx.skip();
      const { port } = await servedApp();
      const member = await signedInMember();

      // AC-4 / Design Decision Interpretation 4: a `loading.tsx` above the guard makes Next
      // answer 200 with the shell and stream the redirect after it — a stranger reading the
      // chrome of a workspace they are about to be sent away from.
      const boundaries = loadingBoundariesUnder(at('src', 'app', 't'));
      expect(
        boundaries,
        'a loading boundary sits above the /t guard — a signed-out request would receive shell bytes',
      ).toEqual([]);

      // A reader with no cookie at all. Each area answers the redirect, and its body carries
      // no part of the frame.
      const stranger: Jar = new Map();
      for (const area of AREAS) {
        const answered = await ask(
          `http://127.0.0.1:${port}/t/${member.slug}/${area.segment}`,
          stranger,
        );
        expect(
          answered.status,
          `a signed-out GET of /${area.segment} answered ${answered.status}, not a redirect`,
        ).toBeGreaterThanOrEqual(300);
        expect(answered.status).toBeLessThan(400);
        expect(
          new URL(answered.location ?? '/', answered.url).pathname,
          `a signed-out GET of /${area.segment} was not sent to /sign-in`,
        ).toBe('/sign-in');

        const leaked = FRAME_TESTIDS.filter((id) => carries(answered.body, id));
        expect(leaked, `a signed-out GET of /${area.segment} received shell bytes`).toEqual([]);
      }
    },
    LANE_BUDGET_MS,
  );
});

describe('AC-3 — the empty states teach the next action (R-UI-033, R-UI-050)', () => {
  it(
    'teaches a first project on Projects, and teaches Books and Settings their own next action',
    async () => {
      const member = await signedInMember();

      for (const area of AREAS) {
        const page = await shellPage(`/t/${member.slug}/${area.segment}`);

        expect(
          carries(page.body, 'empty-state'),
          `/${area.segment} renders no empty-state — R-UI-050 says every screen defines one`,
        ).toBe(true);
        expect(
          carries(page.body, 'empty-state-action'),
          `/${area.segment}'s empty state teaches no next action to take`,
        ).toBe(true);
        expect(
          page.body.includes(copy(area.teachKey)),
          `/${area.segment} does not teach: ${copy(area.teachKey)}`,
        ).toBe(true);
        expect(
          page.body.includes(copy(area.actionKey)),
          `/${area.segment}'s action is not ${copy(area.actionKey)}`,
        ).toBe(true);
      }
    },
    LANE_BUDGET_MS,
  );

  it(
    'gives the inspector its own designed empty state on every shell screen',
    async () => {
      const member = await signedInMember();

      // §5: the inspector at M0 renders the patterns EmptyState with no action — the remedy
      // is selecting something, and nothing is selectable yet.
      for (const path of ['', '/projects', '/books', '/settings', '/sessions']) {
        const page = await shellPage(`/t/${member.slug}${path}`);
        expect(
          page.body.includes(copy('shell.inspector.empty.teach')),
          `the inspector on /t/{tenantSlug}${path} renders no empty state`,
        ).toBe(true);
        expect(
          positionOf(page.body, 'shell-inspector'),
          `the inspector on /t/{tenantSlug}${path} is not in the document`,
        ).toBeGreaterThanOrEqual(0);
      }
    },
    LANE_BUDGET_MS,
  );
});

/** Every `loading.*` route file under a directory, relative to the repository. */
function loadingBoundariesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...loadingBoundariesUnder(path));
    else if (/^loading\.(tsx|ts|jsx|js)$/.test(entry.name)) found.push(path.slice(REPO.length + 1));
  }
  return found;
}
