/**
 * The invitations contract (C-05, inc-010b test contract), declared ONCE: the routes, the
 * `data-testid` names, the module paths the interfaces line fixes, and the readings every suite in
 * this directory makes of the tree and of the two committed Design Decisions.
 *
 * This file asserts nothing about the product — it is the contract plus mechanics, so the rules stay
 * in the suites (ARCH-02). Two habits it keeps deliberately:
 *
 *   - **Nothing the Decisions rule is transcribed.** The refusal entry's copy and the route table's
 *     copy are PARSED out of `docs/design/s-accept-invitation.md`, so the committed document stays
 *     the single home of the words and a suite cannot drift from it (B-19, C-13).
 *   - **Every product module is reached by a checked dynamic import.** A module the Builder has not
 *     written yet must fail as an assertion naming the file, never as a collection death — and a
 *     static import of a file that does not exist yet would also make `next build` (which type-checks
 *     `tests/**`) refuse the tree.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { expect } from "vitest";
import { stripComments } from "../../ui/s-design/support/gallery-contract";

/** The checkout these suites drive — the lane runs at the root of it. */
export const REPO_ROOT: string = process.cwd();

/* --------------------------------------------------------------------------- the contract */

/** Every `data-testid` this increment's test contract fixes, by the name a suite refers to it as. */
export const TESTIDS = {
  inviteForm: "members-invite-form",
  pendingInvitations: "members-pending-invitations",
  email: "invitations-email",
  submit: "invitations-submit",
  row: "invitations-row",
  resend: "invitations-resend",
  revoke: "invitations-revoke",
  refusal: "invitations-refusal",
  none: "invitations-none",
  acceptForm: "accept-invitation-form",
  acceptWorkspace: "accept-invitation-workspace",
  acceptSubmit: "accept-invitation-submit",
  acceptRefusal: "accept-invitation-refusal",
  membersSection: "members-section",
  memberRow: "members-row",
  memberRowRole: "members-row-role",
  switcher: "shell-tenant-switcher",
  membersLink: "settings-members-link",
} as const;

/** The attribute one pending row carries so a suite can tell two invitations apart (AC-2). */
export const INVITATION_ATTRIBUTE = "data-invitation";

/** The routes, as an address bar spells them. */
export const ACCEPT_ROUTE = "/accept-invitation";
export const SIGN_IN_ROUTE = "/sign-in";
export const membersPath = (tenant: string): string => `/t/${tenant}/settings/members`;
export const workspacePath = (tenant: string): string => `/t/${tenant}`;

/** The route key the tree spells the accept screen as — what the matrix and the scan agree on. */
export const ACCEPT_ROUTE_KEY = "/accept-invitation";

/** The homes the interfaces line fixes. */
export const TENANCY_MODULE_DIR = "src/modules/spine/tenancy";
export const ACCEPT_ROUTE_DIR = "src/app/(app)/accept-invitation";
export const MEMBERS_ROUTE_DIR = "src/app/(app)/t/[tenant]/settings/members";

export const MODULES = {
  barrel: `${TENANCY_MODULE_DIR}/index.ts`,
  invitationsHome: `${TENANCY_MODULE_DIR}/invitations`,
  moduleTests: `${TENANCY_MODULE_DIR}/__tests__`,
  acceptPage: `${ACCEPT_ROUTE_DIR}/page.tsx`,
  acceptActions: `${ACCEPT_ROUTE_DIR}/actions.ts`,
  acceptForm: `${ACCEPT_ROUTE_DIR}/accept-invitation-form.tsx`,
  acceptStates: `${ACCEPT_ROUTE_DIR}/states.ts`,
  acceptStrings: `${ACCEPT_ROUTE_DIR}/strings.ts`,
  panelStrings: `${MEMBERS_ROUTE_DIR}/invitations/strings.ts`,
  membersStates: `${MEMBERS_ROUTE_DIR}/states.ts`,
  errors: "src/core/errors.ts",
  matrix: "src/ui/screen-states/matrix.tsx",
  mail: "src/server/auth/mail.ts",
} as const;

/** The barrel exports the interfaces line adds, and the type it adds beside them. */
export const BARREL_EXPORTS = ["createInvitation", "pendingInvitations", "resendInvitation", "revokeInvitation", "acceptInvitation"] as const;
export const BARREL_TYPE = "PendingInvitation";

/** The exports each route-local string table owes, with the prefix its keys carry. */
export const STRING_TABLES = {
  panel: { module: MODULES.panelStrings, exportName: "invitationsStrings", prefix: "invitations_" },
  accept: { module: MODULES.acceptStrings, exportName: "acceptInvitationStrings", prefix: "accept_" },
} as const;

/** The one code this increment appends to the closed taxonomy, and the mail kind it travels with. */
export const CODE = "INVITATION_NOT_CLAIMABLE";
export const MAIL_KIND = "invitation";

/** The link the mail carries — the shape the test contract fixes, checked with `includes`. */
export const ACCEPT_LINK = "/accept-invitation?token=";

/** The codes the panel's answer slot may wear (test contract), and the accept screen's own. */
export const PANEL_CODES = ["WORKSPACE_PERMISSION_NOT_HELD", "RATE_LIMITED", CODE] as const;

/* --------------------------------------------------------------------------- loading product code */

/** A repo-relative path, made absolute against the checkout. */
export const inRepo = (relative: string): string => join(REPO_ROOT, relative);

/** Assert a product file exists — the missing-feature red, named after the file that is missing. */
export function requireModule(relative: string): string {
  const absolute = inRepo(relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return absolute;
}

/**
 * Import a product module by repo-relative path, asserting it exists first. The specifier is held in
 * a variable so this lane's typecheck never resolves a module the Builder has not written yet.
 */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const specifier: string = requireModule(relative);
  return (await import(specifier)) as T;
}

/* --------------------------------------------------------------------------- reading the tree */

const SOURCE = /\.(?:ts|tsx|mts)$/;

/** Every non-test source file under a directory, recursively — `__tests__` and `.d.ts` excluded. */
export function sourceFilesUnder(directory: string, found: string[] = []): string[] {
  if (!existsSync(directory)) return found;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "node_modules") sourceFilesUnder(path, found);
    } else if (SOURCE.test(entry.name) && !entry.name.endsWith(".d.ts") && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

/** Every test file under a directory, recursively — the mirror of `sourceFilesUnder`, which skips them. */
export function testFilesUnder(directory: string, found: string[] = []): string[] {
  if (!existsSync(directory)) return found;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) testFilesUnder(path, found);
    else if (/\.test\.(?:ts|tsx|mts)$/.test(entry.name)) found.push(path);
  }
  return found;
}

/** The path as the repo spells it, with forward slashes, for a message a person can act on. */
export const repoRelative = (absolute: string): string => absolute.slice(REPO_ROOT.length + 1).split("\\").join("/");

/** Every module specifier a file imports — static, type-only, dynamic and `createRequire` alike. */
export function importSpecifiersOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found: string[] = [];
  const patterns = [/\bfrom\s*["']([^"']+)["']/g, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) if (match[1] !== undefined) found.push(match[1]);
  }
  return found;
}

/** Where a relative specifier lands, repo-relative and extensionless — enough to answer "inside X?". */
export function resolvedFrom(file: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  return repoRelative(resolve(dirname(file), specifier));
}

/* ------------------------------------------------------- reading CODE rather than reading text
 *
 * Everything below strips comments first (the tree's own string-aware stripper, ARCH-02). A symbol
 * NAMED in prose is not a symbol the program uses: an apology comment saying a guard is applied
 * elsewhere, or a checklist of refusal codes inside a test that asserts nothing, must not be able to
 * satisfy a wiring question. The readings are all structural — a call is a parenthesised invocation,
 * an assertion is the chained statement an `expect` opens — so they answer the same way however the
 * Builder lays the code out (B-19).
 */

/** A file's source with its comments removed, by absolute or repo-relative path. */
export function codeOf(file: string): string {
  return stripComments(readFileSync(isAbsolute(file) ? file : inRepo(file), "utf8"));
}

/** Where a name is CALLED in code, by index — a mention that is not an invocation is not a hit. */
export function callIndices(code: string, name: string): number[] {
  return [...code.matchAll(new RegExp(`\\b${name}\\s*\\(`, "g"))].map((match) => (match.index ?? 0) + match[0].length - 1);
}

/** The text a bracket opened at `open` encloses, strings honoured — the argument span of a call. */
function balancedFrom(code: string, open: number): [number, number] {
  let depth = 0;
  let quote: string | null = null;
  for (let index = open; index < code.length; index += 1) {
    const char = code[index] ?? "";
    if (quote !== null) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) return [open, index];
    }
  }
  return [open, code.length];
}

/** The argument spans of every call to a name — what that call syntactically WRAPS. */
export function callSpans(code: string, name: string): [number, number][] {
  return callIndices(code, name).map((open) => balancedFrom(code, open));
}

/** The span a bracket at `open` encloses — for a call spelled by something other than a bare name. */
export const balancedSpanAt = (code: string, open: number): [number, number] => balancedFrom(code, open);

/**
 * Every `expect(…)` assertion in a file, as the whole chained statement it is written as: from the
 * call to the `;` (or the line that ends it), brackets and strings honoured. A value named inside one
 * of these is a value something is graded against; a value named anywhere else is decoration.
 */
export function expectStatements(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(/\bexpect\s*[.(]/g)) {
    const start = match.index ?? 0;
    let depth = 0;
    let quote: string | null = null;
    let end = code.length;
    for (let index = start; index < code.length; index += 1) {
      const char = code[index] ?? "";
      if (quote !== null) {
        if (char === "\\") index += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "(" || char === "[" || char === "{") depth += 1;
      else if (char === ")" || char === "]" || char === "}") {
        depth -= 1;
        if (depth < 0) {
          end = index;
          break;
        }
      } else if (depth === 0 && char === ";") {
        end = index;
        break;
      } else if (depth === 0 && char === "\n" && !/^\s*\./.test(code.slice(index + 1, index + 40))) {
        end = index;
        break;
      }
    }
    found.push(code.slice(start, end));
  }
  return found;
}

/** The brace blocks enclosing an index — the function body a call is made in, and its parents. */
export function enclosingBlocks(code: string, index: number): [number, number][] {
  const open: number[] = [];
  const found: [number, number][] = [];
  let quote: string | null = null;
  for (let at = 0; at < code.length; at += 1) {
    const char = code[at] ?? "";
    if (quote !== null) {
      if (char === "\\") at += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") open.push(at);
    else if (char === "}") {
      const from = open.pop();
      if (from !== undefined && from <= index && index <= at) found.push([from, at]);
    }
  }
  return found;
}

/** The member or binding an index sits inside, as its file names it — how a page object is pinned. */
export function enclosingMemberName(code: string, index: number): string | null {
  const pattern = /(?:^|\n)[ \t]*(?:export\s+|public\s+|private\s+|protected\s+|readonly\s+|static\s+|async\s+|const\s+|let\s+|function\s+|get\s+)*([A-Za-z_$][\w$]*)\s*[(=:]/g;
  let name: string | null = null;
  for (const match of code.slice(0, index).matchAll(pattern)) name = match[1] ?? name;
  return name;
}

/** Every import a file makes, as the clause it brought in by name and the specifier it came from. */
export function importsOf(code: string): { clause: string; specifier: string }[] {
  return [...code.matchAll(/\bimport\s+([^;]*?)\s*from\s*["']([^"']+)["']/g)].map((match) => ({ clause: match[1] ?? "", specifier: match[2] ?? "" }));
}

/** The file a relative specifier really names, with the extensions a resolver would try. */
export function resolveSpecifierFile(file: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const landed = resolve(dirname(isAbsolute(file) ? file : inRepo(file)), specifier);
  const candidates = [landed, `${landed}.ts`, `${landed}.tsx`, `${landed}.mts`, `${landed}/index.ts`, `${landed}/index.tsx`];
  return candidates.find((path) => existsSync(path) && statSync(path).isFile()) ?? null;
}

/** The landings a specifier may use to name a file: its own path, and its directory when it is an index. */
export function moduleIdsOf(file: string): string[] {
  const relative = repoRelative(isAbsolute(file) ? file : inRepo(file)).replace(/\.(?:tsx?|mts)$/, "");
  return relative.endsWith("/index") ? [relative, relative.slice(0, -"/index".length)] : [relative];
}

/** Every module a specifier could import an identifier FROM — its home and whatever re-publishes it. */
export function modulesPublishing(identifier: string): Set<string> {
  const landings = new Set<string>();
  for (const file of sourceFilesUnder(inRepo("src"))) {
    const publishes = codeOf(file)
      .split("\n")
      .some((line) => line.includes("export") && new RegExp(`\\b${identifier}\\b`).test(line));
    if (publishes) for (const id of moduleIdsOf(file)) landings.add(id);
  }
  return landings;
}

/** Every file reachable from an entry by its own imports — what a screen really mounts. */
export function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [isAbsolute(entry) ? entry : inRepo(entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    const relative = repoRelative(file);
    if (seen.has(relative) || !existsSync(file)) continue;
    seen.add(relative);
    for (const specifier of importSpecifiersOf(file)) {
      const landed = resolveSpecifierFile(file, specifier);
      if (landed !== null) queue.push(landed);
    }
  }
  return seen;
}

/* --------------------------------------------------------------------------- the Decisions */

export const ACCEPT_DECISION = "docs/design/s-accept-invitation.md";
export const SETTINGS_DECISION = "docs/design/s-settings.md";

/** One committed Design Decision, read whole. */
export function decision(relative: string): string {
  return readFileSync(requireModule(relative), "utf8");
}

/** Whitespace as a reader sees it: a value wrapped over two lines of markdown is one sentence. */
export const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

/**
 * The copy the Decision fixes verbatim for a route table, parsed out of its §3: every
 * `` `key` **value** `` pair whose key carries the table's prefix. Parsed rather than transcribed, so
 * the committed document stays the words' one home (C-13).
 */
export function decisionCopy(text: string, prefix: string): Map<string, string> {
  const copy = new Map<string, string>();
  const pattern = new RegExp("`(" + prefix + "[a-z0-9_]+)`\\s*\\*\\*([^*]+)\\*\\*", "g");
  for (const match of text.matchAll(pattern)) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined && !copy.has(key)) copy.set(key, collapse(value));
  }
  return copy;
}

/** One registered refusal as a Decision's table row states it: severity, surface, message, remedy. */
export interface DecisionEntry {
  severity: string;
  surface: string;
  message: string;
  remedy: string;
}

/** The row of a Decision's registry table naming a code — the entry the register must hold. */
export function decisionEntry(text: string, code: string): DecisionEntry {
  const row = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("|") && line.includes(`| ${code} |`));
  expect(row, `${ACCEPT_DECISION} must state ${code}'s registry row — the Decision is the copy's home (C-13)`).toBeDefined();
  const cells = (row ?? "")
    .split("|")
    .slice(1, -1)
    .map((cell) => collapse(cell).replace(/^\*\*|\*\*$/g, ""));
  const [, severity = "", surface = "", message = "", remedy = ""] = cells;
  return { severity, surface, message, remedy };
}
