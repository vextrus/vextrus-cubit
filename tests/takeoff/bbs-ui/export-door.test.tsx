// @vitest-environment jsdom
/**
 * I-bbs-8 — the export door on S-BBS, rendered: the one primary stands for a permitted reader with
 * bars to render and for nobody else, a press starts the keyed job and mounts the job strip where
 * the render was started, and the issued document's link follows a success (R-TO-054, R-UI-024,
 * R-UI-080, AM-05, docs/design/s-bbs.md §1).
 *
 * The workspace is mounted with the chrome its interface declares, each renderer a stub that
 * publishes what it was handed — so what is graded is the workspace's own composition of the door,
 * never the primitives' pixels (I-170). The document is the fixture's golden schedule, read through
 * the one home the golden lane publishes and never typed here (AM-01, B-19). Nothing here opens a
 * database and nothing here measures time (AM-10 §3).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BbsChrome, BbsJobStep } from "../../../src/modules/takeoff/bbs-ui/workspace";
import { BbsWorkspace } from "../../../src/modules/takeoff/bbs-ui/workspace";
import type { BbsDocument, BbsView } from "../../../src/modules/takeoff/bbs-ui/view";
import { TESTIDS } from "../../../src/ui/testids";
import { goldenBbsDocument } from "./support/golden-document";

/** The ids the registry spells for this door (AM-09 §1) — the workspace falls back to the same. */
const EXPORT = TESTIDS.bbs.export;
const JOBS = TESTIDS.bbs.jobs;
const DOCUMENT_LINK = TESTIDS.bbs.documentLink;

/** The permission the door names (L-ACT-03). */
const MEASURE = "MEASURE";

afterEach(() => {
  cleanup();
});

/**
 * A stub that renders its children and every data attribute it was handed, so a read can find it.
 * A `variant` is published the way the shipped Button publishes one — as `data-variant` — because
 * that is the attribute a reader of the primary reads (Direction §7 C11).
 */
function passThrough(tag: keyof HTMLElementTagNameMap): ComponentType<Record<string, unknown>> {
  const Stub = (props: Record<string, unknown>): ReactNode => {
    const Tag = tag as "div";
    const attributes = Object.fromEntries(
      Object.entries(props)
        .filter(([key]) => key !== "children" && key !== "content" && key !== "onClick" && key !== "onRetry")
        .map(([key, value]) => (key === "variant" ? ["data-variant", value] : [key, value])),
    );
    return (
      <Tag {...(attributes as Record<string, string>)} onClick={props["onClick"] as (() => void) | undefined}>
        {props["children"] as ReactNode}
      </Tag>
    );
  };
  return Stub;
}

/** The chrome the workspace's interface declares, every renderer a stub. */
function chrome(): BbsChrome {
  return {
    DataTable: (({ data, "aria-label": label }: { data: unknown[]; "aria-label"?: string }) => (
      <div data-testid={TESTIDS.datatable.root} data-rows-rendered={String(data.length)} aria-label={label} />
    )) as BbsChrome["DataTable"],
    EmptyState: passThrough("section") as BbsChrome["EmptyState"],
    ErrorState: passThrough("section") as BbsChrome["ErrorState"],
    RefusalState: (({ refusal }: { refusal: { code: string } }) => <div data-testid={TESTIDS.refusal.state} data-code={refusal.code} />) as BbsChrome["RefusalState"],
    IdChip: (({ value, "data-testid": testId }: { value: string; "data-testid"?: string }) => <span data-testid={testId} data-value={value} />) as BbsChrome["IdChip"],
    EnumLabel: (({ value }: { value: string }) => <span data-technical={value}>{value}</span>) as BbsChrome["EnumLabel"],
    Skeleton: passThrough("span") as BbsChrome["Skeleton"],
    Tooltip: (({ children }: { children: ReactNode }) => <>{children}</>) as BbsChrome["Tooltip"],
    Note: (({ label }: { label: string }) => <button aria-label={label} />) as BbsChrome["Note"],
    JobTimeline: (({ heading, steps }: { heading: string; steps: readonly BbsJobStep[] }) => (
      <ol data-testid={TESTIDS.job.timeline} data-steps={String(steps.length)} aria-label={heading} />
    )) as BbsChrome["JobTimeline"],
    Button: passThrough("button") as BbsChrome["Button"],
  };
}

/** A reading with everything to render: a pinned campaign and the fixture's whole golden schedule. */
function wholeView(): BbsView {
  return { campaignId: "campaign-1", setRevisionId: "revision-1", document: goldenBbsDocument() as unknown as BbsDocument, partial: false };
}

/** A reading with a campaign and no bar at all — nothing to export. */
function emptyView(): BbsView {
  return { campaignId: "campaign-1", setRevisionId: "revision-1", document: { ...(goldenBbsDocument() as unknown as BbsDocument), rows: [] }, partial: false };
}

const refusalOf = (code: string): { code: string; message: string; remedy: string; severity: "info"; surface: "inline" } => ({ code, message: code, remedy: code, severity: "info", surface: "inline" });

describe("I-bbs-8: the export door stands where the Decision puts it, and for whom", () => {
  it("stands as the one primary for a permitted reader with bars to render, naming MEASURE, and no job strip stands at rest", () => {
    render(<BbsWorkspace view={wholeView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf, exportSchedule: vi.fn() }} />);
    const door = screen.getByTestId(EXPORT);
    expect(door.getAttribute("data-permission"), "the door names the permission it asks for (L-ACT-03)").toBe(MEASURE);
    expect(door.getAttribute("data-variant"), "and it is the screen's ONE primary (Direction §7 C11)").toBe("primary");
    expect(door.getAttribute("aria-disabled"), "open, not shut, while nothing is watched and the connection stands").toBeNull();
    expect(screen.queryByTestId(JOBS), "no job strip stands at rest — never an empty box (R-UI-080)").toBeNull();
  });

  it("is absent — never disabled — for a reader without MEASURE, and where nothing is scheduled", () => {
    render(<BbsWorkspace view={wholeView()} permitted={false} tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf, exportSchedule: vi.fn() }} />);
    expect(screen.queryByTestId(EXPORT), "a reader denied the whole screen is offered no door on it (I-bbs-1)").toBeNull();
    cleanup();
    render(<BbsWorkspace view={emptyView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf, exportSchedule: vi.fn() }} />);
    expect(screen.queryByTestId(EXPORT), "a campaign that scheduled no bar has nothing to export, so the door does not render").toBeNull();
  });

  it("is shut, and says so, while the connection is gone", () => {
    render(<BbsWorkspace view={wholeView()} permitted offline tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf, exportSchedule: vi.fn() }} />);
    expect(screen.getByTestId(EXPORT).getAttribute("aria-disabled"), "a render nobody can enqueue is a door that says it is shut (R-UI-020)").toBe("true");
  });

  it("a press starts the keyed job once, mounts the job strip where the render was started, and the issued link follows the document", async () => {
    const exportSchedule = vi.fn(async () => ({ jobId: "job-1", deduplicated: false }));
    const started = vi.fn();
    const steps: BbsJobStep[] = [
      { id: "s1", jobId: "job-1", kind: "bbs-render", status: "running", timing: null, refusal: null, faultId: null, evidence: { href: "/x", label: "x" } },
    ];
    const { rerender } = render(
      <BbsWorkspace view={wholeView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf, exportSchedule }} onExportStarted={started} jobs={{ steps }} />,
    );
    fireEvent.click(screen.getByTestId(EXPORT));
    await screen.findByTestId(JOBS);
    expect(exportSchedule, "one press, one job (I-270)").toHaveBeenCalledTimes(1);
    expect(started, "and the route is told which job to watch").toHaveBeenCalledWith("job-1");
    expect(screen.getByTestId(JOBS).getAttribute("data-job"), "the strip names the job it watches").toBe("job-1");
    expect(screen.getByTestId(TESTIDS.job.timeline).getAttribute("data-steps"), "over the steps the register read").toBe("1");
    expect(screen.getByTestId(EXPORT).getAttribute("aria-disabled"), "a second press while the first is watched is not offered").toBe("true");
    expect(screen.queryByTestId(DOCUMENT_LINK), "no link stands until the issue is filed").toBeNull();

    rerender(
      <BbsWorkspace view={wholeView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf, exportSchedule }} onExportStarted={started} jobs={{ steps, documentId: "doc-1" }} />,
    );
    const link = screen.getByTestId(DOCUMENT_LINK);
    expect(link.getAttribute("data-document"), "the link names the issue the render filed").toBe("doc-1");
    expect(link.getAttribute("href"), "and leads to the project's documents, where the issue stands").toBe("/t/t/p/p/documents");
  });

  it("a refused door is answered in the one answer slot by its registered code, never a toast", async () => {
    const exportSchedule = vi.fn(async () => {
      throw Object.assign(new Error("refused"), { refusalCode: "BBS_NO_CAMPAIGN" });
    });
    render(<BbsWorkspace view={wholeView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf, exportSchedule }} />);
    fireEvent.click(screen.getByTestId(EXPORT));
    const refusal = await screen.findByTestId(TESTIDS.refusal.state);
    expect(refusal.getAttribute("data-code"), "the registered code the door answered with, rendered through the one renderer (R-UI-020)").toBe("BBS_NO_CAMPAIGN");
    expect(screen.queryByTestId(JOBS), "and no job strip is mounted for a run that never started").toBeNull();
  });
});
