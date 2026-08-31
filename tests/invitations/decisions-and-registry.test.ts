/**
 * AC-2 and AC-3, in the part that is settled before a browser is opened: the two Design Decisions
 * that rule these surfaces, the registry entry the accept flow answers with, the route-local copy,
 * and the states row the accept screen declares twice by law (B-19).
 *
 * Nothing here transcribes copy. The words are PARSED out of the committed Decisions and the shape
 * of a states row is read off the shipped members row — so the Decision stays the one home of the
 * copy (C-13), and a later screen that grows a state or a key is not broken by a roster frozen here.
 */
import { describe, expect, test } from "vitest";
import {
  ACCEPT_DECISION,
  ACCEPT_ROUTE,
  ACCEPT_ROUTE_KEY,
  CODE,
  INVITATION_ATTRIBUTE,
  MODULES,
  SETTINGS_DECISION,
  STRING_TABLES,
  TESTIDS,
  collapse,
  decision,
  decisionCopy,
  decisionEntry,
  inRepo,
  productModule,
  requireModule,
} from "./support/invitations-contract";

/** The ids the invitations panel renders inside I-61's two frozen slots (the test contract). */
const PANEL_TESTIDS = [TESTIDS.email, TESTIDS.submit, TESTIDS.row, TESTIDS.resend, TESTIDS.revoke, TESTIDS.refusal, TESTIDS.none] as const;

/** The ids the accept screen renders (the test contract, and the accept Decision's §7). */
const ACCEPT_TESTIDS = [TESTIDS.acceptForm, TESTIDS.acceptWorkspace, TESTIDS.acceptSubmit, TESTIDS.acceptRefusal] as const;

/** One registered refusal, as a suite may hold it without the registry's own closed key type. */
type Entry = { code: string; message: string; remedy: string; severity: string; surface: string };

describe("AC-2: the members Decision is revised to author the invitations panel (discharging I-61)", () => {
  test("AC-2: the revision names every id the panel renders inside I-61's two slots", () => {
    const text = decision(SETTINGS_DECISION);
    const missing = PANEL_TESTIDS.filter((testId) => !text.includes(testId));
    expect(
      missing,
      `docs/design/s-settings.md is revised by this increment to author the panel's internals — I-61 fixed only the two outer slots, and a surface whose ids no Decision rules is graded against nothing (AC-2, C-13)`,
    ).toEqual([]);
    expect(text.includes(INVITATION_ATTRIBUTE), `the revision rules the ${INVITATION_ATTRIBUTE} attribute one pending row carries`).toBe(true);
  });

  test("AC-2: the revision rules the panel's copy, and the route table holds it verbatim", async () => {
    const ruled = decisionCopy(decision(SETTINGS_DECISION), STRING_TABLES.panel.prefix);
    expect(
      ruled.size,
      `the s-settings revision fixes the panel's copy verbatim — keys ${STRING_TABLES.panel.prefix}… with their sentences, the way every other Decision in this tree fixes copy (C-13)`,
    ).toBeGreaterThan(0);

    const table = await productModule<Record<string, unknown>>(STRING_TABLES.panel.module);
    const strings = table[STRING_TABLES.panel.exportName] as Record<string, string> | undefined;
    expect(strings, `${STRING_TABLES.panel.module} exports ${STRING_TABLES.panel.exportName} (the interfaces line)`).toBeDefined();

    const held = strings ?? {};
    for (const key of Object.keys(held)) {
      expect(key.startsWith(STRING_TABLES.panel.prefix), `${key} is a key of the panel's own table, so it carries the ${STRING_TABLES.panel.prefix} prefix`).toBe(true);
    }
    const wrong = [...ruled].filter(([key, value]) => collapse(String(held[key] ?? "")) !== value).map(([key]) => key);
    expect(wrong, `these keys do not carry the sentence the revised Decision fixes for them — the Decision is the copy's home, not a paraphrase of the build (C-13)`).toEqual([]);
  });
});

describe("AC-3: the accept screen's Decision, registry entry, copy and states row", () => {
  test("AC-3: the committed accept Decision rules the route and every id it renders", () => {
    const text = decision(ACCEPT_DECISION);
    expect(text.includes(ACCEPT_ROUTE), `the Decision fixes the route ${ACCEPT_ROUTE} (C-05)`).toBe(true);
    const missing = ACCEPT_TESTIDS.filter((testId) => !text.includes(testId));
    expect(missing, "every id the accept screen's contract fixes is ruled by its Decision (C-05, C-13)").toEqual([]);
  });

  test("AC-3: INVITATION_NOT_CLAIMABLE is registered exactly as the Decision states it, and frozen", async () => {
    const ruled = decisionEntry(decision(ACCEPT_DECISION), CODE);
    const errors = await productModule<Record<string, unknown>>(MODULES.errors);
    const registry = errors["REFUSALS"] as Record<string, Entry | undefined> | undefined;
    expect(registry, "src/core/errors.ts publishes the closed registry").toBeDefined();

    const entry = (registry ?? {})[CODE];
    expect(entry, `${CODE} is appended once to src/core/errors.ts — the taxonomy is closed, so a code that is not registered does not exist (AC-3, B-06)`).toBeDefined();
    expect(entry?.code, `${CODE}'s entry carries its own key, so a screen reads the value off the register instead of respelling it (Q-07)`).toBe(CODE);
    expect(collapse(entry?.message ?? ""), "the message is the Decision's, word for word").toBe(ruled.message);
    expect(collapse(entry?.remedy ?? ""), "the remedy is the Decision's, word for word").toBe(ruled.remedy);
    expect(entry?.severity, "the severity is the Decision's").toBe(ruled.severity);
    expect(entry?.surface, "the surface is the Decision's").toBe(ruled.surface);
    expect(Object.isFrozen(entry), "an entry read at a screen is the registered answer, never a mutated one").toBe(true);

    const refusalOf = errors["refusalOf"] as ((code: string) => Entry) | undefined;
    expect(typeof refusalOf, "src/core/errors.ts publishes the accessor").toBe("function");
    expect(refusalOf?.(CODE), `refusalOf("${CODE}") answers the registered entry`).toBe(entry);
  });

  test("AC-3: the accept route's string table holds the Decision's copy, verbatim", async () => {
    const ruled = decisionCopy(decision(ACCEPT_DECISION), STRING_TABLES.accept.prefix);
    expect(ruled.size, "the accept Decision's §3 fixes the route table's copy verbatim (C-13)").toBeGreaterThan(0);

    const table = await productModule<Record<string, unknown>>(STRING_TABLES.accept.module);
    const strings = table[STRING_TABLES.accept.exportName] as Record<string, string> | undefined;
    expect(strings, `${STRING_TABLES.accept.module} exports ${STRING_TABLES.accept.exportName} with keys ${STRING_TABLES.accept.prefix}… (the interfaces line)`).toBeDefined();

    const held = strings ?? {};
    for (const key of Object.keys(held)) {
      expect(key.startsWith(STRING_TABLES.accept.prefix), `${key} is a key of the accept route's own table, so it carries the ${STRING_TABLES.accept.prefix} prefix`).toBe(true);
    }
    const wrong = [...ruled].filter(([key, value]) => collapse(String(held[key] ?? "")) !== value).map(([key]) => key);
    expect(wrong, "these keys do not carry the sentence the Decision fixes for them — the screen renders the Decision's words (C-13)").toEqual([]);
  });

  test("AC-3: the screen declares its states row in its route, in the shipped cell shape", async () => {
    // The shape is read off the members row the tree already ships, never frozen here: whatever the
    // shell's state names are, the accept screen's row answers all of them and no others (B-19).
    const members = await productModule<Record<string, unknown>>(MODULES.membersStates);
    const membersRow = members["MEMBERS_STATES"] as Record<string, { declared?: string }> | undefined;
    expect(membersRow, "the shipped members row is the shape a route's states row is written in").toBeDefined();

    const accept = await productModule<Record<string, unknown>>(MODULES.acceptStates);
    const acceptRow = accept["ACCEPT_INVITATION_STATES"] as Record<string, { declared?: string }> | undefined;
    expect(acceptRow, `${MODULES.acceptStates} exports ACCEPT_INVITATION_STATES — the row is declared in the route as well as in the matrix (AC-3, B-19)`).toBeDefined();

    const expected = Object.keys(membersRow ?? {}).sort();
    expect(Object.keys(acceptRow ?? {}).sort(), "the row answers every state the shell names, and invents none").toEqual(expected);
    for (const [name, cell] of Object.entries(acceptRow ?? {})) {
      expect(
        ["rendered", "delegated", "impossible"].includes(String(cell.declared)),
        `the ${name} cell says one of the three things a cell may say — rendered here, delegated to a named home, or impossible with a reason (R-UI-050)`,
      ).toBe(true);
    }
  });

  test("AC-3: the matrix gains the accept route's row, and no existing row is disturbed", async () => {
    const matrix = await productModule<Record<string, unknown>>(MODULES.matrix);
    const screens = matrix["screenStates"] as Record<string, Record<string, unknown>> | undefined;
    expect(screens, "src/ui/screen-states/matrix.tsx publishes the exhibited matrix").toBeDefined();

    const declared = screens ?? {};
    expect(
      Object.keys(declared),
      `the matrix declares ${ACCEPT_ROUTE_KEY} — a screen's states row is declared twice by law, in its route and in the matrix (AC-3, B-19)`,
    ).toContain(ACCEPT_ROUTE_KEY);

    // The append does not move what was there: every route the tree already exhibited is still
    // declared, read from the tree rather than from a list frozen in this file.
    const scan = await productModule<Record<string, unknown>>("src/ui/screen-states/route-scan.ts");
    const routesOnDisk = scan["routesOnDisk"] as ((root?: string) => readonly string[]) | undefined;
    if (typeof routesOnDisk === "function") {
      const missing = routesOnDisk(inRepo("src/app")).filter((route) => !(route in declared));
      expect(missing, "every route the tree serves is declared in the matrix — the accept route joins them, and none is displaced").toEqual([]);
    }
    requireModule(MODULES.acceptPage);
  });
});
