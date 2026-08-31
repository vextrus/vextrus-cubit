// What an invitation needs from the server tier, as ports rather than imports (ARCH-01: a module may
// not reach the server layer). Every one of them already has exactly one home up there — the token
// mint and its digest, the address fold `users.email` is written through and read back by, and the
// outbox — so the invitation home calls them instead of growing its own (B-17).
//
// They arrive beside `admit` on `TenancyHardening`, which is how the counting home already reaches
// this module: the server binds the guarded entry once and hands over the machinery it owns.

/** The machinery an invitation is minted, addressed and mailed with, all of it the server's own. */
export interface InvitationMachinery {
  /** A fresh bearer secret — the token the mailed link carries, answered once and never stored. */
  mintToken(): string;
  /** The digest a token is stored under, so a reader of the table can present nothing. */
  digestToken(secret: string): string;
  /** The key an address is carried under, the same fold `users.email` is written through (I-58). */
  storedKey(address: string): string;
  /** The address itself, as a mail is addressed to it — a key is not somewhere mail arrives. */
  mailedAddress(address: string): string;
  /** The fold read back: the address a key carries, or null for a key that carries none (I-58). */
  addressForKey(key: string): string | null;
  /** Hand the invitation to the one mail home, which is the only tier that writes the outbox. */
  send(mail: { to: string; token: string; origin: string }): void | Promise<void>;
}

/**
 * The machinery plus the one fact that belongs to the request rather than to the deployment's
 * bindings: the address this deployment states it answers at, which the mailed link is built on. The
 * guarded entry adds it from the request whose origin it has just verified, so a link never points
 * at an address a caller wrote (R-SPINE-001).
 */
export interface InvitationPorts extends InvitationMachinery {
  readonly origin: string;
}
