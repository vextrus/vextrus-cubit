"use client";
// The app layer's mount for R-SPINE-050's palette: it stands over every `/t/{tenant}/**` address,
// holds the transport and the addresses, and hands the pattern typed rows (ARCH-01 — `src/ui`
// imports no app code, and this is the seam between them).
import { useCallback, useMemo, type ReactNode } from "react";
import { CommandPalette, CommandPaletteProvider, ShortcutSheet, type PaletteAnswer, type PaletteRow } from "@/ui/patterns/command-palette";
import { goRowOf, paletteRows, rowOfHit } from "./rows";
import type { SearchFn } from "./search-action";

export interface PaletteHostProps {
  tenantId: string;
  /** The project the address stands inside, or null (`projectOf` reads it from the pathname). */
  projectId: string | null;
  /** The workspace seam. Injected, so the palette's behaviour is judged over answers, not servers. */
  search: SearchFn;
  navigate: (href: string) => void;
  children?: ReactNode;
}

export function PaletteHost({ tenantId, projectId, search, navigate, children }: PaletteHostProps) {
  const rows = useMemo<readonly PaletteRow[]>(() => paletteRows(tenantId, projectId), [tenantId, projectId]);

  const goRow = useCallback((shortcutId: string): PaletteRow | null => goRowOf(tenantId, rows, shortcutId), [tenantId, rows]);

  /**
   * The seam's answer, turned into rows: each hit's kind is mapped through the address home that
   * owns it, and the envelope's own refusal and fault id travel on unchanged — the pattern reads
   * that envelope and no other carrier (risk note 3).
   */
  const ask = useCallback(
    async (query: string): Promise<PaletteAnswer> => {
      const answer = await search({ tenantId, query });
      return {
        rows: (answer.hits ?? []).map((hit) => rowOfHit(tenantId, hit)),
        refusal: answer.refusal ?? null,
        faultId: answer.faultId ?? null,
      };
    },
    [search, tenantId],
  );

  return (
    <CommandPaletteProvider tenantId={tenantId} projectId={projectId} rows={rows} search={ask} navigate={navigate} goRow={goRow}>
      {children}
      {/* Both overlays portal to the document body, outside the frame the children draw (I-144). */}
      <CommandPalette />
      <ShortcutSheet />
    </CommandPaletteProvider>
  );
}
