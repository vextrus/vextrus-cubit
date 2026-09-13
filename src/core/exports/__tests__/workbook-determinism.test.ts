// A build is a pure function of its spec, or the artefact is not evidence (R-SPINE-021).
//
// An .xlsx is a zip of XML, and two different clocks leak into it: `docProps/core.xml` carries the
// model's created/modified dates, and every zip entry carries a DOS timestamp. Left alone, both are
// the moment of the build, so one spec would have an unbounded family of content addresses and
// "stored at the sha256 of its own bytes" would mean nothing. Both are pinned at EXPORT_EPOCH, and
// this is the suite that says so: two builds a real interval apart, and the same spec built under
// three different machine timezones, all answer the same bytes.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildWorkbook, EXPORT_EPOCH, type WorkbookSpec } from "@/core/exports";

/** A spec with one of everything a cell can be: text, a quantity, money, and a live formula. */
const SPEC: WorkbookSpec = {
  sheets: [
    {
      name: "Bill",
      freezeHeader: true,
      columns: [
        { key: "item", header: "Item", kind: "text" },
        { key: "quantity", header: "Quantity", kind: "number", fractionDigits: 3 },
        { key: "rate", header: "Rate", kind: "money" },
        { key: "amount", header: "Amount", kind: "money" },
      ],
      rows: [["Concrete M25", "12345.678", "8500.00", { formula: "B2*C2" }]],
    },
  ],
};

const addressOf = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** The machine's stated timezone, moved for one build and put back whatever the build does. */
async function builtUnder(timezone: string): Promise<Uint8Array> {
  const stated = process.env["TZ"];
  process.env["TZ"] = timezone;
  try {
    return await buildWorkbook(SPEC);
  } finally {
    process.env["TZ"] = stated;
  }
}

describe("two builds of one spec are one artefact", () => {
  it("answers byte-identical bytes for builds at different moments", async () => {
    const first = await buildWorkbook(SPEC);
    // A real interval, spanning the second boundary a wall clock would have written into the zip.
    await new Promise((settle) => setTimeout(settle, 1_100));
    const second = await buildWorkbook(SPEC);

    expect(addressOf(second), "the same spec has one content address, not one per second").toBe(addressOf(first));
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
  });

  it("answers the same bytes whatever timezone the machine states", async () => {
    const here = await builtUnder("UTC");
    for (const timezone of ["Asia/Dhaka", "America/Los_Angeles"]) {
      expect(addressOf(await builtUnder(timezone)), `a build under ${timezone} is the same artefact`).toBe(addressOf(here));
    }
  });

  it("stamps the epoch, and nothing of the hour it was built in, inside the archive", async () => {
    const bytes = await buildWorkbook(SPEC);
    const { default: JSZip } = await import("jszip");
    const archive = await JSZip.loadAsync(Buffer.from(bytes));

    const epoch = new Date(EXPORT_EPOCH).getTime();
    const entries = Object.values(archive.files);
    expect(entries.length, "the artefact is an archive of parts").toBeGreaterThan(0);
    for (const entry of entries) {
      // A DOS timestamp holds two-second resolution and no timezone, so the entry's date is the
      // epoch to within the unit the format can hold.
      expect(Math.abs(entry.date.getTime() - epoch), `${entry.name} is dated at EXPORT_EPOCH`).toBeLessThanOrEqual(2_000);
    }

    const core = await archive.file("docProps/core.xml")?.async("string");
    expect(core, "an .xlsx carries its document dates in docProps/core.xml").toBeDefined();
    expect(core ?? "", "the created date is the epoch, not the hour of the build").toContain("2000-01-01T00:00:00Z");
  });
});
