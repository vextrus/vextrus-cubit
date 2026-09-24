// S-Ask's own address, spelled once (B-17): the address the takeoff lane's nav links, the address
// this screen answers at, and the address the ⌘K row composes with a question (docs/design/s-ask.md
// §6, I-402). The question travels as `?q=`, asked once on arrival and then taken off the address.

/** The query a question travels under (test contract). */
export const QUESTION_PARAM = "q";

export function askRoute(tenantId: string, projectId: string, question?: string): string {
  const base = `/t/${tenantId}/p/${projectId}/takeoff/ask`;
  const asked = question?.trim() ?? "";
  return asked === "" ? base : `${base}?${QUESTION_PARAM}=${encodeURIComponent(asked)}`;
}
