// The upload seam as a journey drives it (inc-102's test contract). The pattern that gathers files
// is mounted only in the gallery this increment, so J-010's upload leg is walked over the three
// routes themselves — through `page.request`, which carries the browser context's own session, so
// what the journey exercises is a signed-in person's transfer and not a bespoke client.
import { expect, type APIResponse, type Page } from "@playwright/test";

/** The addresses the test contract names, spelled once so a journey never writes a path twice. */
export const UPLOAD = Object.freeze({
  create: "/api/upload",
  one: (uploadId: string): string => `/api/upload/${uploadId}`,
} as const);

/** One drawing a completed upload records. */
export interface DrawingAnswer {
  drawingId: string;
  name: string;
  sha256: string;
  format: string;
  duplicate: boolean;
}

/** An answer, read as the journey reads answers. */
export interface UploadAnswer {
  status: number;
  body: {
    uploadId?: string;
    receivedBytes?: number;
    chunkBytes?: number;
    size?: number;
    state?: string;
    complete?: boolean;
    drawings?: DrawingAnswer[];
    skipped?: { name: string; reason: string }[];
    refusal?: { code: string; message: string; remedy: string };
  };
}

async function read(answer: APIResponse): Promise<UploadAnswer> {
  const text = await answer.text();
  const status = answer.status();
  if (text.trim() === "") return { status, body: {} };
  try {
    return { status, body: JSON.parse(text) as UploadAnswer["body"] };
  } catch {
    throw new Error(`the upload door answered ${status} with a body that is not JSON: ${text.slice(0, 300)}`);
  }
}

export class UploadPage {
  constructor(private readonly page: Page) {}

  /** Open an upload session for a file of this project. */
  async create(input: { projectId: string; name: string; size: number; sha256: string }): Promise<UploadAnswer> {
    return read(await this.page.request.post(UPLOAD.create, { data: input }));
  }

  /** Send one chunk, from the offset the server last acknowledged. */
  async send(uploadId: string, offset: number, bytes: Buffer): Promise<UploadAnswer> {
    return read(
      await this.page.request.fetch(UPLOAD.one(uploadId), {
        method: "PATCH",
        headers: { "upload-offset": String(offset), "content-type": "application/octet-stream" },
        data: bytes,
      }),
    );
  }

  /** Probe a session — what a client asks after an interruption, before it resumes. */
  async status(uploadId: string): Promise<UploadAnswer> {
    return read(await this.page.request.get(UPLOAD.one(uploadId)));
  }

  /** The one drawing a completed answer carries, asserted to be exactly one. */
  onlyDrawing(answer: UploadAnswer): DrawingAnswer {
    const drawings = answer.body.drawings ?? [];
    expect(drawings.length, "one presented file records one drawing").toBe(1);
    return drawings[0] as DrawingAnswer;
  }
}
