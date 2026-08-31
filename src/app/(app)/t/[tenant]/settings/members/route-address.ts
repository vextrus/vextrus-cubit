// This screen's own address, spelled once (B-17): the href the settings landing's link resolves to,
// the path a committed move revalidates, and the place a refusal whose remedy is the roster itself
// points back at.
export function membersRoute(tenantId: string): string {
  return `/t/${tenantId}/settings/members`;
}
