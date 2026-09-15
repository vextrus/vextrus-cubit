// The render seam's unhappy path (ARCH-03, B-21, R-SPINE-062).
//
// A renderer that falls over is OUR outage, not the caller's statement — so it is recorded once at
// the fault seam and answered with a registered code carrying the id of that record. What must never
// happen is the other three things a seam can do with a subprocess failure: swallow it, improvise a
// sentence for it, or hand the person who asked for a document the renderer's stack.
//
// Both the subprocess and the faces are injected, so this judges the SEAM's behaviour and not the
// machine's: the fault is the one the test raised, and no vendored byte is read to reach it.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REFUSALS } from "../../errors";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { setFaultSink, type FaultRecord } from "../../faults/report";
import type { EmbeddedFont } from "../fonts";
import { renderDocument } from "../index";
import type { StagedRender } from "../typst";

const ctx = { requestId: "render-fault-request", actor: "render-fault-suite" };

/** The committed proof payload's shape, at this kind's stated precision. */
const PAYLOAD = Object.freeze({
  title: "Renderer failure",
  project: "F-RCC6 six-storey residential",
  lines: [Object.freeze({ ref: "1.01", description: "A line the renderer never gets to set", quantity: "12.500", unit: "m" })],
});

/** A face that maps everything: coverage is `fonts.test.ts`'s question, not this one's. */
const everyGlyph: readonly EmbeddedFont[] = Object.freeze([
  Object.freeze({ file: "spline-sans-regular.ttf", sha256: "0".repeat(64), licence: "OFL-spline-sans.txt", covers: () => true }),
]);

/** Runs a render with the subprocess replaced, collecting whatever the fault seam was told. */
async function renderWith(compile: (staged: StagedRender) => Promise<Uint8Array>): Promise<{ failure: unknown; recorded: FaultRecord[] }> {
  const recorded: FaultRecord[] = [];
  const previous = setFaultSink((record) => recorded.push(record));
  try {
    const failure = await renderDocument("proof", PAYLOAD, ctx, { compile, fonts: async () => everyGlyph }).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    return { failure, recorded };
  } finally {
    setFaultSink(previous);
  }
}

describe("a renderer that fails is recorded once and answered by name", () => {
  it("answers DOCUMENT_NOT_RENDERED rather than the subprocess's own failure", async () => {
    const { failure } = await renderWith(() => Promise.reject(new Error("typst exited 1: unexpected end of block comment")));
    expect(refusalCodeOf(failure), "a renderer that fell over is a registered answer, never a raw failure (B-21)").toBe("DOCUMENT_NOT_RENDERED");
  });

  it("records the outage exactly once, against the route and the caller who asked", async () => {
    const { recorded } = await renderWith(() => Promise.reject(new Error("typst exited 1")));
    expect(recorded.length, "one failure is one record — a seam that recorded twice would double every alert (ARCH-03)").toBe(1);
    const record = recorded[0];
    expect(record?.route, "the record names the render, and which kind it was").toBe("renderDocument/proof");
    expect(record?.requestId).toBe(ctx.requestId);
    expect(record?.actor).toBe(ctx.actor);
    expect(record?.cause, "the renderer's own account is what the OPERATOR is given").toContain("typst exited 1");
  });

  it("gives the caller the fault id and none of the renderer's account of itself", async () => {
    const { failure, recorded } = await renderWith(() => Promise.reject(new Error("typst exited 1: /tmp/cubit-document-XYZ/main.typ:3:9 unexpected token")));
    const message = String((failure as { message?: unknown }).message);
    expect(message, "the id is how an operator finds the record this caller's failure made").toContain(recorded[0]?.faultId ?? "no fault was recorded");
    expect(message, "a stack, a temp path and a renderer's stderr are the operator's, never the caller's (B-21)").not.toContain("unexpected token");
    expect((failure as { stack?: unknown }).stack, "the marker is an Error of this seam's own, not the subprocess failure re-thrown").not.toContain("main.typ");
  });

  it("carries a remedy, because a person who is told no is told what to do next", () => {
    const entry = REFUSALS.DOCUMENT_NOT_RENDERED;
    expect(entry.remedy.length, "R-SPINE-062: every registered refusal states what resolves it").toBeGreaterThan(0);
    expect(entry.message, "the message says what happened, and says nothing about a subprocess").not.toMatch(/typst|stack|stderr/iu);
  });

  it("records nothing when the render succeeds — a fault stream is for outages, not for work", async () => {
    const { failure, recorded } = await renderWith(() => Promise.resolve(new Uint8Array([1, 2, 3])));
    expect(failure, "a compile that answered is a document, not a failure").toBeNull();
    expect(recorded, "recording a success would fill the operator's stream with the product working").toEqual([]);
  });

  it("stages the template's whole world, and leaves none of it behind when the compile throws", async () => {
    const staged: string[] = [];

    const { failure } = await renderWith(async (render) => {
      staged.push(render.dir);
      // While the compile runs, the world it was given is really there: the payload the template
      // reads, the frame it imports, and the mark that frame draws — and nothing outside the root.
      expect(existsSync(join(render.dir, "payload.json")), "the payload is staged for the template to read").toBe(true);
      expect(existsSync(join(render.dir, "base", "frame.typ")), "and the page frame it imports").toBe(true);
      expect(existsSync(join(render.dir, "base", "mark.svg")), "and the brand mark that frame draws").toBe(true);
      expect(render.main.startsWith(render.dir), "the entry compiled stands inside the root the renderer is given").toBe(true);
      throw new Error("typst exited 1");
    });

    expect(refusalCodeOf(failure), "the compile failed, so the render is refused by name").toBe("DOCUMENT_NOT_RENDERED");
    expect(staged.length, "the compile was reached, so there was a directory to clean up").toBe(1);
    expect(existsSync(staged[0] ?? ""), "a staging directory that outlived its render is a payload left on the volume").toBe(false);
  });
});
