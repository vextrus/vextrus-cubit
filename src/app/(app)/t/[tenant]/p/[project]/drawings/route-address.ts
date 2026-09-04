// This screen's own address, spelled once (B-17): the path a commit revalidates, and the path a
// refusal whose remedy is this very index points back at.
export function drawingsRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/drawings`;
}
