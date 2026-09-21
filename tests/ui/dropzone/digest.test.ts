/**
 * Verification of client-side file digest calculation in secure and insecure contexts.
 * When accessing via non-secure HTTP (such as WSL2/LAN IP addresses), `crypto.subtle`
 * is undefined in modern browsers. `digestOf` must reliably fall back to pure JS SHA-256
 * without throwing `TypeError: Cannot read properties of undefined (reading 'digest')`.
 */
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { digestOf, sha256Fallback } from "@/ui/patterns/dropzone/upload-client";

describe("digestOf and sha256Fallback: client-side SHA-256", () => {
  const testCases = [
    { name: "empty payload", data: new Uint8Array(0) },
    { name: "short text", data: new TextEncoder().encode("hello world") },
    { name: "boundary 55 bytes", data: new TextEncoder().encode("a".repeat(55)) },
    { name: "boundary 56 bytes", data: new TextEncoder().encode("a".repeat(56)) },
    { name: "boundary 64 bytes", data: new TextEncoder().encode("a".repeat(64)) },
    { name: "multi-block 128 bytes", data: new TextEncoder().encode("a".repeat(128)) },
    { name: "arbitrary binary 2048 bytes", data: new Uint8Array(Array.from({ length: 2048 }, (_, i) => (i * 31) % 256)) },
  ];

  test("sha256Fallback produces identical lowercase hex digest to node:crypto", () => {
    for (const { data } of testCases) {
      const expected = createHash("sha256").update(data).digest("hex");
      const actual = sha256Fallback(data);
      expect(actual).toBe(expected);
    }
  });

  test("digestOf succeeds when crypto.subtle is available", async () => {
    for (const { data } of testCases) {
      const blob = new Blob([data]);
      const expected = createHash("sha256").update(data).digest("hex");
      const actual = await digestOf(blob);
      expect(actual).toBe(expected);
    }
  });

  test("digestOf succeeds when crypto.subtle is undefined (insecure context fallback)", async () => {
    const originalCrypto = globalThis.crypto;
    try {
      // Simulate non-secure context where crypto.subtle is undefined
      const mockCrypto = {
        ...originalCrypto,
        subtle: undefined,
      };
      Object.defineProperty(globalThis, "crypto", {
        value: mockCrypto,
        configurable: true,
        writable: true,
      });

      for (const { data } of testCases) {
        const blob = new Blob([data]);
        const expected = createHash("sha256").update(data).digest("hex");
        const actual = await digestOf(blob);
        expect(actual).toBe(expected);
      }
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
    }
  });
});
