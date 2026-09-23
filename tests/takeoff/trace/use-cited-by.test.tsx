// @vitest-environment jsdom
/**
 * VD-1 — the other direction of X-2 asks for exactly the keys held (I-423).
 *
 * A held key is a source key of ANY registered scheme (L-CAD-02), and a PDF object's key carries a
 * comma (`PDF_OBJECT:12,0`). The hook once remembered what was held as the keys joined by that very
 * comma and split them back, so a held PDF object asked the door for two keys nobody holds — the same
 * defect walk-0 found in the `s` parameter. Nothing is transcribed: the ask is compared with what was
 * held.
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useCitedBy, type CitingDoor } from "../../../src/modules/takeoff/trace/use-trace";

const TENANT = "8f1d6c3a-0a5e-4a7b-9c2d-000000000001";
const PROJECT = "8f1d6c3a-0a5e-4a7b-9c2d-000000000002";
const DRAWING = "8f1d6c3a-0a5e-4a7b-9c2d-000000000003";

afterEach(() => {
  cleanup();
});

describe("VD-1: useCitedBy asks for the held keys, each whole", () => {
  test("VD-1: a held key carrying a comma is asked for as one key, in the order it was held", async () => {
    const held = ["PDF_OBJECT:12,0", "DXF_HANDLE:9A2"];
    const read = vi.fn<CitingDoor>(async () => ({ read: true, lines: [] }));
    const { rerender } = renderHook((props: { selection: readonly string[] }) => useCitedBy({ tenantId: TENANT, projectId: PROJECT, drawingId: DRAWING, selection: props.selection, read, onRefused: () => undefined }), {
      initialProps: { selection: held },
    });

    await waitFor(() => expect(read, "the door is asked once something is held").toHaveBeenCalledTimes(1));
    expect(read.mock.calls[0]?.[0].sourceKeys, "exactly the keys held — a PDF object's `12,0` is one key, never two").toEqual(held);

    // The same keys in a fresh array are the same selection: nothing is read again.
    rerender({ selection: [...held] });
    await waitFor(() => expect(read, "a re-render holding the same keys asks nothing again").toHaveBeenCalledTimes(1));
  });
});
