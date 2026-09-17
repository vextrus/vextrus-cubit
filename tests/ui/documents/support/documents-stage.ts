/**
 * The stage S-Documents' acceptance stands on (inc-300b-documents-list).
 *
 * `DocumentsScreen` takes its whole answer as props, so the screen can be judged over injected rows:
 * what is asserted here is the SCREEN's own behaviour, never the server read that feeds it. Product
 * modules are loaded by absolute path through `productModule`, so a file the Builder has not written
 * yet fails as an assertion naming it rather than as a collection death that would read as a defect
 * in the acceptance.
 *
 * Nothing here reads product source and nothing here judges the product. Every name below is one the
 * increment's interface list, its test contract or the committed Design Decision
 * (docs/design/s-documents.md) publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it from
 * the checkout by absolute path (the s-project stage's precedent). The fixtures are declared once,
 * here, and imported everywhere they are asserted (B-19); keep it free of judgement so neither lane
 * can hide one in it.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { cleanup, render } from "@testing-library/react";
import { createElement, type FunctionComponent } from "react";
import { expect } from "vitest";
import { productModule } from "../../../server/support/wire";
import { TESTIDS, isTestId } from "../../../../src/ui/testids";

export { productModule };

/** The group this screen publishes its ids under, as the registry holds it today (AM-09 §1). */
const group = (TESTIDS as unknown as { documents?: Record<string, string> }).documents ?? {};

/**
 * One id of this screen, by the key the registry files it under — never a literal in a suite
 * (`cubit/no-literal-testid`). An id this checkout does not publish is not a test id at all, and
 * saying so by name is the red this increment is owed until the group lands.
 */
export function documentsId(key: string): string {
  const id = group[key];
  if (typeof id !== "string" || !isTestId(id)) {
    throw new Error(`src/ui/testids.ts publishes no TESTIDS.documents.${key} — S-Documents has not landed its ids yet`);
  }
  return id;
}

/* ------------------------------------------------------------------ the homes the spec names */

/** The mountable screen (increment interfaces). */
export const DOCUMENTS_SCREEN_MODULE = "src/app/(app)/t/[tenant]/p/[project]/documents/documents-screen.tsx";

/** `documentsRoute(tenantId, projectId)` — the one spelling of this screen's address. */
export const DOCUMENTS_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/documents/route-address.ts";

/** The screen's own copy, keyed `documents_…` (Decision §3). */
export const DOCUMENTS_STRINGS_MODULE = "src/ui/strings/documents.ts";

/** `QUICK_ACTIONS` and the route builders S-Project's areas table holds, `takeoffRoute` among them. */
export const PROJECT_HOME_AREAS_MODULE = "src/app/(app)/t/[tenant]/p/[project]/home/areas.ts";

/** The one identifier primitive (R-UI-082) — the short form it renders is read from it, never guessed. */
export const ID_CHIP_MODULE = "src/ui/primitives/core/id-chip.tsx";

/** R-UI-050's matrix, made arithmetic: `missingStates(routes)`. */
export const SCREEN_STATES_MODULE = "src/ui/screen-states/index.ts";

/** The file route the states matrix is keyed by (test contract). */
export const DOCUMENTS_FILE_ROUTE = "/t/[tenant]/p/[project]/documents";

/** The document kind the stage issues, and the kind the copy table names a label for (AC-1). */
export const PROOF = "proof";

/* --------------------------------------------------------------------- the fixtures, declared once */

/** The workspace and the project every bare mount in both lanes stands on (B-19: one identity). */
export const TENANT = "5a1f0b3c-1111-4111-8111-111111111111";
export const PROJECT = "5a1f0b3c-2222-4222-8222-222222222222";

/** The person who issued every staged document — a uuid, and therefore chip material (R-UI-082). */
export const ISSUER = "5a1f0b3c-3333-4333-8333-333333333333";

/** `DocumentsRowView` (increment interfaces): one listing as the screen is handed it. */
export interface DocumentsRowLike {
  readonly id: string;
  readonly kind: string;
  readonly version: number;
  readonly sha256: string;
  readonly issuedBy: string;
  readonly actIds: readonly string[];
  readonly supersededBy: string | null;
  readonly href: string;
}

/** A component of the product, as this stage mounts one. */
export type Mountable = (props: Record<string, unknown>) => unknown;

/** A 64-hex address, distinguishable from its neighbours by the character it is made of. */
export function digest(of: string): string {
  return of.repeat(64).slice(0, 64);
}

/** A link of the shape the download door answers at (test contract), for a row of this stage. */
export function aSignedHref(id: string, tenantId: string = TENANT): string {
  return `/api/documents/${id}?tenant=${tenantId}&expires=1789000000&signature=${digest("a")}`;
}

/** One listing, with every field the screen renders stated on it. */
export function aDocumentRow(over: Partial<DocumentsRowLike> = {}): DocumentsRowLike {
  const id = over.id ?? "5a1f0b3c-4444-4444-8444-444444444444";
  return {
    id,
    kind: PROOF,
    version: 1,
    sha256: digest("b"),
    issuedBy: ISSUER,
    actIds: ["5a1f0b3c-5555-4555-8555-555555555555"],
    supersededBy: null,
    href: aSignedHref(id),
    ...over,
  };
}

/**
 * The two issues the journey's stage writes, in `listDocuments`' own order: version 2, then the
 * version 1 it superseded — each citing one act, as `stageDocuments` cites one (AC-1).
 */
export function twoIssues(): readonly DocumentsRowLike[] {
  const first = "5a1f0b3c-6666-4666-8666-666666666661";
  const second = "5a1f0b3c-6666-4666-8666-666666666662";
  return [
    aDocumentRow({ id: second, version: 2, sha256: digest("c"), actIds: ["5a1f0b3c-7777-4777-8777-777777777772"], supersededBy: null }),
    aDocumentRow({ id: first, version: 1, sha256: digest("d"), actIds: ["5a1f0b3c-7777-4777-8777-777777777771"], supersededBy: second }),
  ];
}

/* -------------------------------------------------------------------------------- the loaders */

/** The screen itself, by the export the increment's interfaces name. */
export async function documentsScreen(): Promise<Mountable> {
  const module = await productModule<Record<string, unknown>>(DOCUMENTS_SCREEN_MODULE);
  expect(typeof module["DocumentsScreen"], `${DOCUMENTS_SCREEN_MODULE} publishes \`DocumentsScreen\` (increment interfaces)`).toBe("function");
  return module["DocumentsScreen"] as Mountable;
}

/**
 * The screen's copy, found by the keys the Design Decision §3 fixes rather than by the export's
 * name — a table is a table whatever it is called (the project-home stage's precedent).
 */
export async function documentsStrings(): Promise<Record<string, string>> {
  const module = await productModule<Record<string, unknown>>(DOCUMENTS_STRINGS_MODULE);
  for (const value of Object.values(module)) {
    if (value !== null && typeof value === "object" && "documents_title" in (value as Record<string, unknown>)) {
      return value as Record<string, string>;
    }
  }
  throw new Error(`${DOCUMENTS_STRINGS_MODULE} publishes no table carrying the keys the Design Decision §3 fixes (documents_…)`);
}

/** One string of that table, by the key the Decision fixes — never a literal transcribed beside it. */
export function copy(table: Record<string, string>, key: string): string {
  const said = table[key];
  expect(typeof said, `the screen's string table states \`${key}\` (docs/design/s-documents.md §3)`).toBe("string");
  expect((said ?? "").trim().length, `\`${key}\` says something — a state that teaches nothing is not a state (R-UI-050)`).toBeGreaterThan(0);
  return said as string;
}

/** `documentsRoute(tenantId, projectId)` (increment interfaces). */
export async function documentsRoute(): Promise<(tenantId: string, projectId: string) => string> {
  const module = await productModule<Record<string, unknown>>(DOCUMENTS_ROUTE_MODULE);
  expect(typeof module["documentsRoute"], `${DOCUMENTS_ROUTE_MODULE} publishes \`documentsRoute\` (increment interfaces)`).toBe("function");
  return module["documentsRoute"] as (tenantId: string, projectId: string) => string;
}

/** One area of the project, as `areas.ts` declares it. */
export interface AreaEntry {
  key: string;
  label: string;
  route: ((tenantId: string, projectId: string) => string) | null;
}

export interface AreasModule {
  PROJECT_AREAS: readonly AreaEntry[];
  QUICK_ACTIONS: readonly AreaEntry[];
  takeoffRoute: (tenantId: string, projectId: string) => string;
}

/** `areas.ts`: the quick actions and the addresses the screens beside this one are reached at. */
export async function areasModule(): Promise<AreasModule> {
  const module = await productModule<Record<string, unknown>>(PROJECT_HOME_AREAS_MODULE);
  expect(Array.isArray(module["QUICK_ACTIONS"]), `${PROJECT_HOME_AREAS_MODULE} publishes \`QUICK_ACTIONS\` (increment interfaces)`).toBe(true);
  expect(typeof module["takeoffRoute"], `${PROJECT_HOME_AREAS_MODULE} publishes \`takeoffRoute\` — the empty state's next action (test contract)`).toBe("function");
  return module as unknown as AreasModule;
}

/** `shortForm(value)` — how much of an opaque value a chip shows, as the primitive itself decides. */
export async function shortForm(): Promise<(value: string) => string> {
  const module = await productModule<Record<string, unknown>>(ID_CHIP_MODULE);
  expect(typeof module["shortForm"], `${ID_CHIP_MODULE} publishes \`shortForm\` — the one home of a chip's short form (R-UI-082)`).toBe("function");
  return module["shortForm"] as (value: string) => string;
}

/** `missingStates(routes)` — what a roster of screens owes R-UI-050 and has not declared. */
export async function missingStates(): Promise<(routes: readonly string[]) => string[]> {
  const module = await productModule<Record<string, unknown>>(SCREEN_STATES_MODULE);
  expect(typeof module["missingStates"], `${SCREEN_STATES_MODULE} publishes \`missingStates\` (test contract)`).toBe("function");
  return module["missingStates"] as (routes: readonly string[]) => string[];
}

/* --------------------------------------------------------------------------------- the mount */

/** What the screen is handed, whole (increment interfaces). */
export interface DocumentsProps {
  rows: readonly DocumentsRowLike[] | null;
  tenantId: string;
  projectId: string;
  reportId: string | null;
}

/** The props of a plain reading of the staged list, with anything the caller wants otherwise. */
export function documentsProps(over: Partial<DocumentsProps> = {}): DocumentsProps {
  return { rows: twoIssues(), tenantId: TENANT, projectId: PROJECT, reportId: null, ...over };
}

/** Mount the screen bare (no shell, no router) and answer its root, the screen id the registry names. */
export function mountDocuments(component: Mountable, props: DocumentsProps): HTMLElement {
  const { container } = render(createElement(component as unknown as FunctionComponent<DocumentsProps>, props));
  const root = container.querySelector(`[data-testid="${documentsId("screen")}"]`);
  expect(root, "DocumentsScreen renders its root screen element (test contract)").not.toBeNull();
  return root as HTMLElement;
}

/**
 * Take down whatever was mounted. Re-exported from the stage rather than imported beside each
 * suite: the held-out lane runs OUTSIDE the checkout, where a bare `@testing-library/react` does not
 * resolve, and one home for the mount means one home for its undoing (B-17).
 */
export function cleanupMounts(): void {
  cleanup();
}

/** Every element carrying one of this screen's ids, by the registry key, in document order. */
export function all(root: HTMLElement, key: string): HTMLElement[] {
  return [...root.querySelectorAll(`[data-testid="${documentsId(key)}"]`)] as HTMLElement[];
}

/** The one element carrying that id — asserted to be exactly one. */
export function one(root: HTMLElement, key: string): HTMLElement {
  const found = all(root, key);
  expect(found.length, `the screen renders exactly one \`${documentsId(key)}\``).toBe(1);
  return found[0] as HTMLElement;
}

/** The rows the screen drew, in the order it drew them. */
export function rowsOf(root: HTMLElement): HTMLElement[] {
  return all(root, "row");
}

/** The row the screen drew for one document, found by the id it carries. */
export function rowOf(root: HTMLElement, documentId: string): HTMLElement {
  const found = rowsOf(root).filter((row) => row.getAttribute("data-document") === documentId);
  expect(found.length, `the list holds exactly one row for document ${documentId}`).toBe(1);
  return found[0] as HTMLElement;
}

/** The cells of one row, in the order a reader reads them (DataTable v2's own roles). */
export function cellsOf(row: HTMLElement): HTMLElement[] {
  return [...row.querySelectorAll('[role="gridcell"], [role="rowheader"]')] as HTMLElement[];
}

/** The text a node states, whitespace-normalised the way a reader sees it. */
export function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** An attribute as the DOM holds it, or `null` — read by the contract's spelling only. */
export function attribute(node: Element, name: string): string | null {
  return node.getAttribute(name);
}
