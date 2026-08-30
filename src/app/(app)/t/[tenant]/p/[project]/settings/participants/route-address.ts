// This screen's own address, spelled once (B-17): the path the commit revalidates, and the path a
// refusal whose remedy is this very form points back at.
export function participantsRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/settings/participants`;
}
