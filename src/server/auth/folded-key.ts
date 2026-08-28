// The fold every caller-written identity is written through, and its one home (B-17, ARCH-02).
//
// Two things force it. A column a caller writes freely into is covered by a btree index, and
// postgres refuses an index row over 2704 bytes (SQLSTATE 54000) — an error carrying no refusal
// marker, so an unfolded value reaches the caller as a fault id for a request the door never
// judged. And some values `text` cannot carry at all.
//
// What makes the fold safe is that *both* spaces say which they are. A digest is unkeyed and
// deterministic — which is what keeps a folded caller reachable under the same value twice — but it
// is therefore a string anybody can compute and then present. Tagged on the folded side alone, the
// literal `digest of <that hex>` presented as a short value would land on the folded value's key:
// two different presented values, one key. Tagged on both sides they cannot meet, because a
// presented value is only ever equal to itself (R-SPINE-001).
import { digestOf } from "./secrets";

/**
 * The key this value is carried under: the value itself when the caller of this fold says the
 * column can carry it, and its digest when it cannot.
 *
 * Whether a value is carriable is the caller's to decide, not this fold's: what a column holds and
 * how much of it an index will take differ per column, while the tagging does not.
 */
export function foldedKey(value: string, carriable: boolean): string {
  return carriable ? `as presented ${value}` : `digest of ${digestOf(value)}`;
}
