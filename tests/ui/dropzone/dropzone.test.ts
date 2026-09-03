// @vitest-environment jsdom
/**
 * AC-6 — the Dropzone pattern (R-SPINE-020, R-UI-011/050/060, B-17, ARCH-01).
 *
 * The pattern is observed through the closed test contract of docs/design/dropzone.md §7 — six
 * `data-testid`s, the root's `data-state`, `data-name`/`data-state` per row and RefusalState's own
 * `data-code` inside a refused one — and through its props. No stylesheet fact is asserted: jsdom
 * lays nothing out, and the paint is the gallery's baselines.
 *
 * The copy is not transcribed here. §3 of the Decision is parsed for the `dropzone_…` keys it
 * rules, and the shipped table is compared against THAT, so a key the Decision adds later is
 * carried by this file without an edit (B-19) and copy drift between document and product is the
 * failure it should be.
 *
 * The file is `.ts`, not `.tsx`: tsconfig's include covers `tests/**\/*.ts`, so a `.tsx` acceptance
 * would run under vitest and never reach `tsc`. Elements are built with `React.createElement`. The
 * pattern itself is loaded by absolute path, so a module the Builder has not written yet fails as
 * an assertion naming the file rather than as a collection death.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { REFUSALS, type RefusalEntry } from "../../../src/core/errors";
import { galleryEntries, missingEntries } from "../../../src/ui/gallery-derivation";

const REPO_ROOT: string = process.cwd();

/** The declared homes (increment interfaces, Decision §7). */
const BARREL = "src/ui/patterns/dropzone/index.ts";
const STRINGS = "src/ui/strings/dropzone.ts";
const DECISION = "docs/design/dropzone.md";

/** The six ids the Decision closes the contract at. */
const TESTIDS = {
  root: "dropzone",
  input: "dropzone-input",
  folderInput: "dropzone-folder-input",
  browse: "dropzone-browse",
  item: "dropzone-item",
  progress: "dropzone-item-progress",
} as const;

/** The gallery key this pattern owes (R-UI-011). */
const GALLERY_KEY = "patterns/dropzone/Dropzone";

/** One queued row, as the consumer composes it (interfaces: DropzoneItem). */
interface Item {
  name: string;
  progress: string;
  state: string;
  refusal?: RefusalEntry;
}

async function productModule<T>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** The pattern's barrel, and the component to mount. */
async function barrel(): Promise<{ exports: string[]; Dropzone: React.ComponentType<Record<string, unknown>> }> {
  const loaded = await productModule<Record<string, unknown>>(BARREL);
  return { exports: Object.keys(loaded).sort(), Dropzone: loaded["Dropzone"] as React.ComponentType<Record<string, unknown>> };
}

/**
 * The copy §3 of the Decision rules, key by key — read from the document rather than written down
 * again here. Bold runs are the copy; the keys are the code spans beside them.
 */
function decisionCopy(): Map<string, string> {
  const path = join(REPO_ROOT, DECISION);
  expect(existsSync(path), `${DECISION} is committed before acceptance is written (C-13)`).toBe(true);
  const document = readFileSync(path, "utf8");
  const start = document.indexOf("## 3.");
  const end = document.indexOf("## 4.", start + 1);
  expect(start >= 0 && end > start, `${DECISION} carries a §3 (copy) and a §4 after it`).toBe(true);
  const section = document.slice(start, end).replace(/\s+/g, " ");
  const copy = new Map<string, string>();
  for (const match of section.matchAll(/`(dropzone_[a-z_]+)`\s+\*\*(.+?)\*\*/g)) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined) copy.set(key, value.trim());
  }
  expect(copy.size, `${DECISION} §3 rules the pattern's copy, key by key`).toBeGreaterThan(0);
  return copy;
}

/** The shipped table for this module, whatever name it is exported under (one table per module). */
async function shippedStrings(): Promise<Record<string, string>> {
  const loaded = await productModule<Record<string, unknown>>(STRINGS);
  const table = Object.values(loaded).find((value) => typeof value === "object" && value !== null);
  expect(table, `${STRINGS} exports the module's string table`).toBeTruthy();
  return table as Record<string, string>;
}

/** Text with its whitespace collapsed — the comparison a rendered node deserves. */
function flat(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** A File that reports the relative path a folder drop gives it, when it was given one. */
function fileNamed(name: string, relativePath?: string): File {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type: "application/octet-stream" });
  if (relativePath !== undefined) Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

/** A drop's payload, in both spellings a browser offers it in. */
function dataTransferOf(files: File[]): Record<string, unknown> {
  return {
    types: ["Files"],
    files: Object.assign(files.slice(), {
      item: (index: number) => files[index] ?? null,
    }),
    items: files.map((file) => ({
      kind: "file",
      type: file.type,
      getAsFile: () => file,
      webkitGetAsEntry: () => ({ isFile: true, isDirectory: false, name: file.name, fullPath: `/${file.name}`, file: (give: (f: File) => void) => give(file) }),
    })),
  };
}

/** Mount the pattern with the props the criterion names. */
async function mount(props: { items: Item[]; onFiles: (files: { name: string; file: File }[]) => void }): Promise<HTMLElement> {
  const { Dropzone } = await barrel();
  const { getByTestId } = render(React.createElement(Dropzone, { ...props }));
  return getByTestId(TESTIDS.root);
}

afterEach(cleanup);

describe("AC-6 — the one upload-gathering pattern", () => {
  test("AC-6: the barrel publishes the component and its client, and nothing else", async () => {
    const { exports } = await barrel();
    expect(exports, `${BARREL} exports Dropzone and uploadFiles only (Decision §0, test contract)`).toEqual(["Dropzone", "uploadFiles"]);
  });

  test("AC-6: the empty pattern is idle, offers both doors, and says the Decision's copy", async () => {
    const copy = decisionCopy();
    const table = await shippedStrings();
    for (const [key, sentence] of copy) {
      expect(table[key], `${STRINGS} carries ${key} exactly as ${DECISION} §3 rules it`).toBe(sentence);
    }

    const root = await mount({ items: [], onFiles: () => undefined });
    expect(root.getAttribute("data-state"), "a pattern nothing is being dragged over is idle").toBe("idle");
    expect(root.querySelector(`[data-testid="${TESTIDS.item}"]`), "an empty queue renders no rows at all (Decision §2, empty)").toBeNull();

    const input = root.querySelector(`[data-testid="${TESTIDS.input}"]`);
    expect(input, "the file door's input is present").not.toBeNull();
    expect((input as HTMLInputElement).multiple, "the file door takes more than one drawing").toBe(true);
    const folder = root.querySelector(`[data-testid="${TESTIDS.folderInput}"]`);
    expect(folder, "the folder door's input is present").not.toBeNull();
    expect(folder?.hasAttribute("webkitdirectory"), "the folder door asks the browser for a directory").toBe(true);
    expect(flat(root.querySelector(`[data-testid="${TESTIDS.browse}"]`)?.textContent ?? ""), "the file door wears the registered label").toBe(copy.get("dropzone_browse"));

    const rendered = flat(root.textContent);
    for (const key of ["dropzone_prompt", "dropzone_browse", "dropzone_browse_folder", "dropzone_accepts"]) {
      const sentence = copy.get(key);
      expect(sentence, `${DECISION} §3 rules ${key}`).toBeTruthy();
      expect(rendered.includes(sentence ?? ""), `the empty pattern says ${key} (R-UI-033, Q-12: what is accepted, said up front)`).toBe(true);
    }
  });

  test("AC-6: a drag flips the state, and a drop reports every file once, under the path it arrived with", async () => {
    const dropped: { name: string; file: File }[][] = [];
    const root = await mount({ items: [], onFiles: (files) => dropped.push(files) });

    fireEvent.dragEnter(root, { dataTransfer: dataTransferOf([]) });
    expect(root.getAttribute("data-state"), "a drag over the pattern is drawn as dragging (Decision I-76)").toBe("dragging");

    const plain = fileNamed("rcc6.dxf");
    const inFolder = fileNamed("A-01.dxf", "arch/A-01.dxf");
    fireEvent.drop(root, { dataTransfer: dataTransferOf([plain, inFolder]) });

    expect(dropped.length, "onFiles is invoked exactly once per drop (Decision §7)").toBe(1);
    expect(
      (dropped[0] ?? []).map((given) => given.name),
      "each file is reported under its webkitRelativePath when the browser set one, and under its name otherwise",
    ).toEqual(["rcc6.dxf", "arch/A-01.dxf"]);
    expect(dropped[0]?.[0]?.file, "the file itself is handed over, not a copy of its name").toBe(plain);
    expect(dropped[0]?.[1]?.file, "the file itself is handed over, not a copy of its name").toBe(inFolder);
    expect(root.getAttribute("data-state"), "the drop ends the drag").toBe("idle");
  });

  test("AC-6: every row renders its name, its state and its progress text verbatim", async () => {
    const copy = decisionCopy();
    const table = await shippedStrings();
    const states = ["queued", "uploading", "stored", "duplicate", "refused"] as const;
    // Read as a record, not as the closed union: this file is compiled against a register that does
    // not carry the upload codes yet, and AC-6 is not the criterion that puts them there.
    const register = REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>;
    const entry = (register["FORMAT_NOT_ACCEPTED"] ?? Object.values(REFUSALS)[0]) as RefusalEntry;
    const items: Item[] = states.map((state, index) => ({
      name: `structural/S-10${index}.dxf`,
      progress: state === "refused" ? "" : `${index}.4 MB of 24.1 MB`,
      state,
      ...(state === "refused" ? { refusal: entry } : {}),
    }));

    const root = await mount({ items, onFiles: () => undefined });
    const rows = Array.from(root.querySelectorAll(`[data-testid="${TESTIDS.item}"]`));
    expect(rows.length, "the queue renders one row per item, in the order the consumer composed them (Decision I-74)").toBe(items.length);

    rows.forEach((row, index) => {
      const item = items[index] as Item;
      expect(row.getAttribute("data-name"), "the row names the file it is for").toBe(item.name);
      expect(row.getAttribute("data-state"), "the row carries the state it was given").toBe(item.state);
      const progress = row.querySelector(`[data-testid="${TESTIDS.progress}"]`);
      expect(progress, "every row carries the progress hook, whatever it holds").not.toBeNull();
      expect(progress?.textContent, "the progress line is the consumer's string, character for character (Decision I-70)").toBe(item.progress);
      expect(row.textContent?.includes(item.name), "the row shows the relative path verbatim").toBe(true);
      const word = table[`dropzone_state_${item.state}`];
      expect(word, `${STRINGS} carries a state word for ${item.state}`).toBeTruthy();
      expect(flat(row.textContent).includes(word ?? ""), `the row says ${item.state} in the registered word (I-72, R-UI-060)`).toBe(true);
    });

    /* --- the refused row: the registered refusal, and no sentence of the pattern's own (I-72) --- */
    const refusedRow = rows[states.indexOf("refused")] as HTMLElement;
    const card = refusedRow.querySelector("[data-code]");
    expect(card, "a refused row renders RefusalState (Decision §1, §7)").not.toBeNull();
    expect(card?.getAttribute("data-code"), "the refusal card carries the code the item was refused under").toBe(entry.code);
    expect(flat(card?.textContent ?? "").includes(entry.message), "the registered message is shown (R-SPINE-062)").toBe(true);
    expect(flat(card?.textContent ?? "").includes(entry.remedy), "the registered remedy is shown").toBe(true);

    const withoutCard = refusedRow.cloneNode(true) as HTMLElement;
    withoutCard.querySelector("[data-code]")?.remove();
    const refusedItem = items[states.indexOf("refused")] as Item;
    expect(
      flat(withoutCard.textContent),
      "beside the refusal the row writes only its name and its state word — the pattern authors no prose about a refusal (I-72)",
    ).toBe(flat(`${refusedItem.name} ${table["dropzone_state_refused"] ?? ""} ${refusedItem.progress}`));
    expect(copy.get("dropzone_state_refused"), "and that word is the Decision's").toBe(table["dropzone_state_refused"]);
  });

  test("AC-6: the gallery publishes the pattern, and owes nothing else", () => {
    expect(Object.keys(galleryEntries), `the catalogue publishes ${GALLERY_KEY} (R-UI-011)`).toContain(GALLERY_KEY);
    expect(missingEntries(), "no component a barrel publishes is missing from the catalogue").toEqual([]);
  });
});
